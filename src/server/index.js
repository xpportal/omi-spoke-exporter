const childProcess = require("child_process");
const chokidar = require("chokidar");
const debounce = require("lodash/debounce");
const envPaths = require("env-paths");
const fetch = require("node-fetch");
const FormData = require("form-data");
const fs = require("fs-extra");
const http = require("http");
const https = require("https");
const isWsl = require("is-wsl");
const Koa = require("koa");
const koaBody = require("koa-body");
const mount = require("koa-mount");
const path = require("path");
const recast = require("@donmccurdy/recast");
const Router = require("koa-router");
const selfsigned = require("selfsigned");
const semver = require("semver");
const serve = require("koa-static");
const sha = require("sha.js");
const WebSocket = require("ws");
const yauzl = require("yauzl");

const packageJSON = require("../../package.json");

function openFile(target) {
  let cmd;
  const args = [];

  if (process.platform === "darwin") {
    cmd = "open";
    args.push("-W");
  } else if (process.platform === "win32" || isWsl) {
    cmd = "cmd" + (isWsl ? ".exe" : "");
    args.push("/c", "start", '""', "/b", "/wait");
    target = target.replace(/&/g, "^&");
  } else {
    cmd = "xdg-open";
  }

  args.push(target);
  childProcess.spawn(cmd, args).unref();
}

function pathToUri(projectPath, path) {
  return path.replace(projectPath, "/api/files").replace(/\\/g, "/");
}

function uriToPath(projectPath, path) {
  return path.replace("/api/files", projectPath);
}

async function getProjectHierarchy(projectPath) {
  async function buildProjectNode(filePath, name, ext, isDirectory, uri) {
    if (!isDirectory) {
      return {
        name,
        ext,
        uri,
        isDirectory
      };
    }

    const children = [];
    const files = [];

    const directoryEntries = await fs.readdir(filePath);

    for (const childEntry of directoryEntries) {
      // eslint-disable-next-line no-useless-escape
      if (/(^|\/)\.[^\/\.]/g.test(childEntry)) {
        continue;
      }

      const childPath = path.resolve(filePath, childEntry);
      const { base, ext } = path.parse(childPath);
      const stats = await fs.stat(childPath);

      const childNode = await buildProjectNode(
        childPath,
        base,
        ext,
        stats.isDirectory(),
        pathToUri(projectPath, childPath)
      );

      if (childNode.isDirectory) {
        children.push(childNode);
      }

      files.push(childNode);
    }

    return {
      name,
      uri,
      children,
      files,
      isDirectory: true
    };
  }

  const projectName = path.parse(projectPath).name;

  const projectHierarchy = await buildProjectNode(projectPath, projectName, undefined, true, "/api/files");

  return projectHierarchy;
}

async function pipeToFile(stream, filePath) {
  // If uploading as text body, write it to filePath using the stream API.
  const writeStream = fs.createWriteStream(filePath, { flags: "w" });

  stream.pipe(writeStream);

  await new Promise((resolve, reject) => {
    function cleanUp() {
      writeStream.removeListener("finish", onFinish);
      writeStream.removeListener("error", onError);
    }

    function onFinish() {
      cleanUp();
      resolve();
    }

    function onError(err) {
      cleanUp();
      reject(err);
    }

    writeStream.on("finish", onFinish);
    writeStream.on("error", onError);
  });
}

function extractZip(zipPath, basePath) {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipFile) => {
      if (err) reject(err);
      zipFile.on("entry", async entry => {
        if (/\/$/.test(entry.fileName)) {
          await fs.ensureDir(path.join(basePath, entry.fileName));
          zipFile.readEntry();
        } else {
          zipFile.openReadStream(entry, async (err, readStream) => {
            if (err) reject(err);
            await pipeToFile(readStream, path.join(basePath, entry.fileName));
            zipFile.readEntry();
          });
        }
      });
      zipFile.on("end", resolve);
      zipFile.readEntry();
    });
  });
}

module.exports = async function startServer(options) {
  const opts = options;

  const projectPath = path.resolve(opts.projectPath);
  const projectDirName = path.basename(projectPath);

  await fs.ensureDir(projectPath);

  const projectFilePath = path.join(projectPath, "spoke-project.json");

  if (!fs.existsSync(projectFilePath)) {
    await fs.writeJSON(projectFilePath, {});
  }

  if (opts.copyDefaultAssets) {
    const exampleDirPath = path.join(__dirname, "..", "..", "example");
    const defaultAssetDirectories = ["ArchitectureKit", "Parthenon"];

    for (const assetDir of defaultAssetDirectories) {
      const src = path.join(exampleDirPath, assetDir);
      const dest = path.join(projectPath, assetDir);
      await fs.copy(src, dest);
    }
  }

  const app = new Koa();

  let server;
  if (opts.https) {
    if (!fs.existsSync(".certs/key.pem")) {
      console.log("Creating selfsigned certs");
      const cert = selfsigned.generate();
      await fs.ensureDir(".certs");
      fs.writeFileSync(path.join(".certs", "key.pem"), cert.private);
      fs.writeFileSync(path.join(".certs", "cert.pem"), cert.cert);
    }
    server = https.createServer(
      {
        key: fs.readFileSync(path.join(".certs", "key.pem")),
        cert: fs.readFileSync(path.join(".certs", "cert.pem"))
      },
      app.callback()
    );
  } else {
    server = http.createServer(app.callback());
  }
  const wss = new WebSocket.Server({ server });

  function broadcast(json) {
    const message = JSON.stringify(json);

    for (const client of wss.clients) {
      client.send(message);
    }
  }

  let projectHierarchy = await getProjectHierarchy(projectPath);

  const debouncedBroadcastHierarchy = debounce(async () => {
    projectHierarchy = await getProjectHierarchy(projectPath);
    broadcast({
      type: "projectHierarchyChanged",
      hierarchy: projectHierarchy
    });
  }, 1000);

  chokidar
    .watch(opts.projectPath, {
      alwaysWriteFinish: true
    })
    .on("all", (type, filePath) => {
      broadcast({
        type,
        path: pathToUri(projectDirName, filePath)
      });
      debouncedBroadcastHierarchy();
    });

  wss.on("connection", ws => {
    const message = JSON.stringify({
      type: "projectHierarchyChanged",
      hierarchy: projectHierarchy
    });

    ws.send(message);
  });

  if (process.env.NODE_ENV === "development") {
    console.log("Running in development environment");

    app.use(async (ctx, next) => {
      try {
        await next();
      } catch (err) {
        ctx.status = err.status || 500;
        ctx.body = err.message;
        ctx.app.emit("error", err, ctx);
      }
    });

    const koaWebpack = require("koa-webpack");
    const webpack = require("webpack");
    const config = require("../../webpack.config.js");
    const compiler = webpack(config);

    try {
      const devMiddleware = await koaWebpack({
        compiler,
        hotClient: opts.https ? false : { host: { server: "0.0.0.0", client: "*" } }
      });
      app.use(devMiddleware);
    } catch (e) {
      throw e;
    }
  } else {
    app.use(serve(path.join(__dirname, "..", "..", "public")));
  }

  const router = new Router();

  router.get("/api/files", async ctx => {
    ctx.body = projectHierarchy;
  });

  app.use(
    mount(
      "/api/files/",
      serve(projectPath, {
        hidden: true,
        setHeaders: res => {
          res.setHeader("Access-Control-Allow-Origin", "*");
        }
      })
    )
  );

  router.post("/api/files/:filePath*", koaBody({ multipart: true, text: false }), async ctx => {
    const filePath = ctx.params.filePath ? path.resolve(projectPath, ctx.params.filePath) : projectPath;

    if (ctx.request.query.open) {
      // Attempt to open file at filePath with the default application for that file type.
      openFile(filePath);
      ctx.body = { success: true };
      return;
    } else if (ctx.request.query.mkdir) {
      // Make the directory at filePath if it doesn't already exist.
      await fs.ensureDir(filePath);
    } else if (ctx.request.query.remove) {
      await fs.remove(filePath);
    } else if (ctx.request.files) {
      for (const file of Object.values(ctx.request.files)) {
        const destPath = path.join(filePath, file.name);
        await fs.move(file.path, destPath, { overwrite: true });
      }
    } else {
      await pipeToFile(ctx.req, filePath);
    }

    const hierarchy = await getProjectHierarchy(projectPath);

    ctx.body = {
      success: true,
      hierarchy
    };
  });

  router.post("/api/navmesh", koaBody({ multipart: true, text: false }), async ctx => {
    const [position, index] = await Promise.all([
      fs.readFile(ctx.request.files.position.path),
      fs.readFile(ctx.request.files.index.path)
    ]);
    recast.load(new Float32Array(position.buffer), new Int32Array(index.buffer));
    const objMesh = recast.build(
      parseFloat(ctx.request.body.cellSize),
      0.1, // cellHeight
      1.0, // agentHeight
      0.0001, // agentRadius
      0.5, // agentMaxClimb
      45, // agentMaxSlope
      4, // regionMinSize
      20, // regionMergeSize
      12, // edgeMaxLen
      1, // edgeMaxError
      3, // vertsPerPoly
      16, //detailSampleDist
      1 // detailSampleMaxError
    );
    // TODO; Dumb that recast returns an OBJ formatted string. We should have it return an array somehow.
    const { navPosition, navIndex } = objMesh.split("@").reduce(
      (acc, line) => {
        line = line.trim();
        if (line.length === 0) return acc;
        const values = line.split(" ");
        if (values[0] === "v") {
          acc.navPosition[acc.navPosition.length] = Number(values[1]);
          acc.navPosition[acc.navPosition.length] = Number(values[2]);
          acc.navPosition[acc.navPosition.length] = Number(values[3]);
        } else if (values[0] === "f") {
          acc.navIndex[acc.navIndex.length] = Number(values[1]) - 1;
          acc.navIndex[acc.navIndex.length] = Number(values[2]) - 1;
          acc.navIndex[acc.navIndex.length] = Number(values[3]) - 1;
        } else {
          throw new Error(`Invalid objMesh line "${line}"`);
        }
        return acc;
      },
      { navPosition: [], navIndex: [] }
    );
    ctx.body = { navPosition, navIndex };
  });

  const reticulumServer = "hubs.mozilla.com";
  const mediaEndpoint = `https://${reticulumServer}/api/v1/media`;
  const agent = process.env.NODE_ENV === "development" ? https.Agent({ rejectUnauthorized: false }) : null;

  async function tryGetJson(request) {
    const text = await request.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      console.log(`JSON error parsing response from ${request.url} "${text}"`, e);
    }
  }

  router.post("/api/import", koaBody(), async ctx => {
    const origin = ctx.request.body.url;
    const originHash = new sha.sha256().update(origin).digest("hex");
    const filePathBase = path.join(projectPath, "imported", originHash);

    if (fs.existsSync(filePathBase)) {
      const uri = pathToUri(projectPath, path.join(filePathBase, "scene.gltf"));
      const { name } = await fs.readJSON(path.join(filePathBase, "meta.json"));
      ctx.body = { uri, name };
    } else {
      const { raw, meta } = await fetch(mediaEndpoint, {
        agent,
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ media: { url: origin, index: 0 } })
      }).then(tryGetJson);

      await fs.ensureDir(filePathBase);

      let name, author;
      const resp = await fetch(raw, { agent });
      const expected_content_type = (meta && meta.expected_content_type) || "";
      if (expected_content_type.includes("gltf+zip")) {
        const zipPath = `${filePathBase}.zip`;
        await pipeToFile(resp.body, zipPath);
        await extractZip(zipPath, filePathBase);
        await fs.remove(zipPath);

        const sceneFilePath = path.join(filePathBase, "scene.gltf");
        const gltf = await fs.readJSON(sceneFilePath);
        const sketchfabExtras = gltf.asset && gltf.asset.extras;
        name = sketchfabExtras && sketchfabExtras.title;
        author = sketchfabExtras && sketchfabExtras.author.replace(/ \(http.+\)/, "");

        const uri = pathToUri(projectPath, sceneFilePath);
        ctx.body = { uri, name };
      } else {
        // If we don't have an expected_content_type, assume they are gltfs.
        // We're calling these .gltf files, but they could be glbs.
        const filePath = path.join(filePathBase, "scene.gltf");
        await pipeToFile(resp.body, filePath);
        const uri = pathToUri(projectPath, filePath);
        name = meta && meta.name;
        author = meta && meta.author;
        ctx.body = { uri, name };
      }

      await fs.writeJSON(path.join(filePathBase, "meta.json"), { ...meta, origin, name, author });
    }
  });

  function getCredentialsPath() {
    return path.join(envPaths("Spoke", { suffix: "" }).config, "spoke-credentials.json");
  }

  router.post("/api/credentials", koaBody(), async ctx => {
    const credentialsPath = getCredentialsPath();
    await fs.ensureDir(path.dirname(credentialsPath));
    await fs.writeJSON(credentialsPath, { credentials: ctx.request.body.credentials });
    ctx.status = 200;
  });

  async function getCredentials() {
    const credentialsPath = getCredentialsPath();
    if (fs.existsSync(credentialsPath)) {
      const json = await fs.readJSON(credentialsPath);
      return (json && json.credentials) || null;
    }
    return null;
  }

  router.get("/api/authenticated", koaBody(), async ctx => {
    const authenticated = !!(await getCredentials());
    ctx.status = authenticated ? 200 : 401;
  });

  router.post("/api/upload", koaBody(), async ctx => {
    const { uri } = ctx.request.body;
    const path = uriToPath(projectPath, uri);

    const fileStream = fs.createReadStream(path);
    const formData = new FormData();
    formData.append("media", fileStream);

    const { file_id, meta } = await fetch(mediaEndpoint, {
      agent,
      method: "POST",
      body: formData
    }).then(tryGetJson);

    fs.remove(path);

    ctx.body = { id: file_id, token: meta.access_token };
  });

  router.post("/api/scene", koaBody(), async ctx => {
    const params = ctx.request.body;
    const sceneParams = {
      screenshot_file_id: params.screenshotId,
      screenshot_file_token: params.screenshotToken,
      model_file_id: params.glbId,
      model_file_token: params.glbToken,
      scene_file_id: params.sceneFileId,
      scene_file_token: params.sceneFileToken,
      allow_remixing: params.allowRemixing,
      allow_promotion: params.allowPromotion,
      name: params.name,
      description: params.description,
      attribution: params.attribution
    };

    const sceneId = params.sceneId;

    const credentials = await getCredentials();
    if (!credentials) {
      ctx.status = 401;
      return;
    }

    const headers = {
      "content-type": "application/json",
      authorization: `Bearer ${credentials}`
    };
    const body = JSON.stringify({ scene: sceneParams });

    let sceneEndpoint = `https://${reticulumServer}/api/v1/scenes`;
    let method = "POST";
    if (sceneId) {
      sceneEndpoint = `${sceneEndpoint}/${sceneId}`;
      method = "PATCH";
    }

    const resp = await fetch(sceneEndpoint, { agent, method, headers, body });
    if (resp.status === 401) {
      ctx.status = 401;
      return;
    }

    const json = await tryGetJson(resp);
    const { url, scene_id } = json.scenes[0];
    ctx.body = { url, sceneId: scene_id };
  });

  const nodePlatformToAssetPlatform = {
    win32: "win",
    darwin: "macos",
    linux: "linux"
  };
  function getDownloadUrlForCurrentPlatform(assets) {
    const assetPlatform = nodePlatformToAssetPlatform[process.platform];
    return assets.find(asset => asset.name.includes(assetPlatform)).downloadUrl;
  }

  const updateInfoTimeout = 2000;

  async function fetchReleases(after) {
    // Read-only, public access token.
    const token = "de8cbfb4cc0281c7b731c891df431016c29b0ace";

    const result = await fetch("https://api.github.com/graphql", {
      timeout: updateInfoTimeout,
      method: "POST",
      headers: { authorization: `bearer ${token}` },
      body: JSON.stringify({
        query: `
          {
            repository(owner: "mozillareality", name: "spoke") {
              releases(
                orderBy: { field: CREATED_AT, direction: DESC },
                first: 5,
                ${after ? `after: "${after}"` : ""}
              ) {
                nodes {
                  isPrerelease,
                  isDraft,
                  tag { name },
                  releaseAssets(last: 3) {
                    nodes { name, downloadUrl }
                  }
                },
                pageInfo { endCursor, hasNextPage }
              }
            }
          }
        `
      })
    }).then(tryGetJson);

    if (!result || !result.data) return;

    return result.data.repository.releases;
  }

  async function getLatestRelease() {
    let release, hasNextPage, after;
    do {
      const releases = await fetchReleases(after);
      if (!releases) return;
      release = releases.nodes.find(release => !release.isPrerelease && !release.isDraft);
      hasNextPage = releases.pageInfo.hasNextPage;
      after = releases.pageInfo.endCursor;
    } while (!release && hasNextPage);

    if (!release) return;

    return {
      version: release.tag.name,
      downloadUrl: getDownloadUrlForCurrentPlatform(release.releaseAssets.nodes)
    };
  }

  router.get("/api/update_info", koaBody(), async ctx => {
    try {
      // This endpoint doesn't exist yet but we query it for future use.
      const configEndpoint = `https://${reticulumServer}/api/v1/config`;
      const { min_spoke_version } =
        (await fetch(configEndpoint, { timeout: updateInfoTimeout }).then(tryGetJson)) || {};

      const latestRelease = await getLatestRelease();

      if (!latestRelease) {
        ctx.body = {};
        return;
      }

      ctx.body = {
        updateAvailable: semver.gt(latestRelease.version, packageJSON.version),
        updateRequired: min_spoke_version && semver.gt(min_spoke_version, packageJSON.version),
        latestVersion: latestRelease.version,
        downloadUrl: latestRelease.downloadUrl
      };
    } catch (e) {
      console.log("Update info check failed", e);
      ctx.body = {};
      return;
    }
  });

  app.use(router.routes());
  app.use(router.allowedMethods());

  server.listen(opts.port);

  if (opts.open) {
    const protocol = opts.https ? "https" : "http";
    openFile(`${protocol}://localhost:${opts.port}`);
  }
};

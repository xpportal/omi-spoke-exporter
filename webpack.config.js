// Variables in .env and .env.defaults will be added to process.env
const dotenv = require("dotenv");
if (process.env.NODE_ENV === "production") {
  dotenv.config({ path: ".env.prod" });
} else {
  dotenv.config({ path: ".env" });
  dotenv.config({ path: ".env.defaults" });
}

const fs = require("fs");
const selfsigned = require("selfsigned");
const cors = require("cors");
const HTMLWebpackPlugin = require("html-webpack-plugin");
const path = require("path");
const packageJSON = require("./package.json");
const webpack = require("webpack");
const TerserJSPlugin = require("terser-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const OptimizeCSSAssetsPlugin = require("optimize-css-assets-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const BundleAnalyzerPlugin = require("webpack-bundle-analyzer").BundleAnalyzerPlugin;

function createHTTPSConfig() {
  // Generate certs for the local webpack-dev-server.
  if (fs.existsSync(path.join(__dirname, "certs"))) {
    const key = fs.readFileSync(path.join(__dirname, "certs", "key.pem"));
    const cert = fs.readFileSync(path.join(__dirname, "certs", "cert.pem"));

    return { key, cert };
  } else {
    const pems = selfsigned.generate(
      [
        {
          name: "commonName",
          value: "localhost"
        }
      ],
      {
        days: 365,
        algorithm: "sha256",
        extensions: [
          {
            name: "subjectAltName",
            altNames: [
              {
                type: 2,
                value: "localhost"
              },
              {
                type: 2,
                value: "hubs.local"
              }
            ]
          }
        ]
      }
    );

    fs.mkdirSync(path.join(__dirname, "certs"));
    fs.writeFileSync(path.join(__dirname, "certs", "cert.pem"), pems.cert);
    fs.writeFileSync(path.join(__dirname, "certs", "key.pem"), pems.private);

    return {
      key: pems.private,
      cert: pems.cert
    };
  }
}

const defaultHostName = "hubs.local";
const host = process.env.HOST_IP || defaultHostName;

module.exports = env => {
  return {
    entry: {
      entry: ["./src/index.js"]
    },

    devtool: process.env.NODE_ENV === "production" ? "source-map" : "inline-source-map",

    devServer: {
      https: createHTTPSConfig(),
      historyApiFallback: true,
      port: 9090,
      host: process.env.HOST_IP || "0.0.0.0",
      public: `${host}:9090`,
      publicPath: process.env.BASE_ASSETS_PATH || "",
      useLocalIp: true,
      allowedHosts: [host],
      headers: {
        "Access-Control-Allow-Origin": "*"
      },
      before: function(app) {
        // be flexible with people accessing via a local reticulum on another port
        app.use(cors({ origin: /hubs\.local(:\d*)?$/ }));
      }
    },

    output: {
      filename: "assets/js/[name]-[chunkhash].js",
      publicPath: process.env.BASE_ASSETS_PATH || "/"
    },

    module: {
      rules: [
        {
          test: /\.(png|jpg|jpeg|gif|svg)(\?.*$|$)/,
          use: {
            loader: "file-loader",
            options: {
              name: "[name]-[hash].[ext]",
              outputPath: "assets/images"
            }
          }
        },
        {
          test: /\.(woff|woff2|ttf|eot)(\?.*$|$)/,
          use: {
            loader: "file-loader",
            options: {
              name: "[name]-[hash].[ext]",
              outputPath: "assets/fonts"
            }
          }
        },
        {
          test: /\.(glb)(\?.*$|$)/,
          use: {
            loader: "file-loader",
            options: {
              name: "[name]-[hash].[ext]",
              outputPath: "assets/models"
            }
          }
        },
        {
          test: /\.(mp4|webm)(\?.*$|$)/,
          use: {
            loader: "file-loader",
            options: {
              name: "[name]-[hash].[ext]",
              outputPath: "assets/videos"
            }
          }
        },
        {
          test: /\.css$/,
          use: [process.env.NODE_ENV !== "production" ? "style-loader" : MiniCssExtractPlugin.loader, "css-loader"]
        },
        {
          test: /\.scss$/,
          include: path.join(__dirname, "src"),
          use: [
            process.env.NODE_ENV !== "production" ? "style-loader" : MiniCssExtractPlugin.loader,
            "css-loader",
            "sass-loader"
          ]
        },
        {
          test: /\.js$/,
          include: path.join(__dirname, "src"),
          use: "babel-loader"
        },
        {
          test: /\.worker\.js$/,
          include: path.join(__dirname, "src"),
          loader: "worker-loader",
          options: {
            name: "assets/js/workers/[name]-[hash].js"
          }
        },
        {
          test: /\.wasm$/,
          type: "javascript/auto",
          include: path.join(__dirname, "src"),
          use: {
            loader: "file-loader",
            options: {
              outputPath: "assets/js/wasm",
              name: "[name]-[hash].[ext]"
            }
          }
        }
      ]
    },

    resolve: {
      alias: {
        three$: path.join(__dirname, "node_modules/three/build/three.module.js")
      }
    },

    optimization: {
      minimizer: [
        new TerserJSPlugin({ sourceMap: true }),
        new OptimizeCSSAssetsPlugin({
          cssProcessorOptions: {
            sourcemap: true,
            map: {
              inline: false,
              annotation: true
            }
          }
        })
      ]
    },

    plugins: [
      new BundleAnalyzerPlugin({
        analyzerMode: env && env.BUNDLE_ANALYZER ? "server" : "disabled"
      }),
      new CopyWebpackPlugin([
        {
          from: path.join(__dirname, "src", "assets", "favicon-spoke.ico"),
          to: "assets/images/favicon-spoke.ico"
        }
      ]),
      new HTMLWebpackPlugin({
        template: path.join(__dirname, "src", "index.html"),
        faviconPath: (process.env.BASE_ASSETS_PATH || "/") + "assets/images/favicon-spoke.ico"
      }),
      new webpack.DefinePlugin({
        SPOKE_VERSION: JSON.stringify(packageJSON.version)
      }),
      new webpack.EnvironmentPlugin({
        NODE_ENV: "development",
        RETICULUM_SERVER: undefined,
        FARSPARK_SERVER: undefined,
        HUBS_SERVER: undefined,
        CORS_PROXY_SERVER: null,
        BASE_ASSETS_PATH: "",
        NON_CORS_PROXY_DOMAINS: "",
        ROUTER_BASE_PATH: ""
      }),
      new webpack.IgnorePlugin({
        resourceRegExp: /^@blueprintjs\//
      }),
      new MiniCssExtractPlugin({
        filename: "assets/styles/[name]-[contenthash].css",
        chunkFilename: "assets/styles/[name]-[contenthash].css"
      })
    ]
  };
};

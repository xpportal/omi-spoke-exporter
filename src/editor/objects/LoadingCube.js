import { Object3D, AnimationMixer, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import loadingCubeUrl from "../../assets/loading-cube.glb";
import cloneObject3D from "../utils/cloneObject3D";
import eventToMessage from "../utils/eventToMessage";

let cubeGltf = null;

export default class LoadingCube extends Object3D {
  static async load() {
    if (cubeGltf) {
      return Promise.resolve(cubeGltf);
    }

    const gltf = await new Promise((resolve, reject) => {
      new GLTFLoader().load(loadingCubeUrl, resolve, null, e => {
        reject(new Error(`Error loading Model. ${eventToMessage(e)}`));
      });
    });

    cubeGltf = gltf;

    return cubeGltf;
  }

  constructor() {
    super();
    this.type = "LoadingCube";

    if (!cubeGltf) {
      throw new Error("LoadingCube must be loaded before it can be used. Await LoadingCube.load()");
    }

    this.model = cloneObject3D(cubeGltf.scene);
    this.add(this.model);
    this.mixer = new AnimationMixer(this);
    this.mixer.clipAction(cubeGltf.animations[0]).play();
    this.worldScale = new Vector3();
  }

  copy(source, recursive) {
    super.copy(source, false);

    for (const child of source.children) {
      let clonedChild;

      if (child === source.model) {
        clonedChild = cloneObject3D(child);
        this.model = clonedChild;
      } else if (recursive === true) {
        clonedChild = child.clone();
      }

      if (clonedChild) {
        this.add(clonedChild);
      }
    }

    return this;
  }

  update(dt) {
    const worldScale = this.getWorldScale(this.worldScale);

    if (worldScale.x === 0 || worldScale.y === 0 || worldScale.z === 0) {
      return;
    }

    this.model.scale.set(2 / worldScale.x, 2 / worldScale.y, 2 / worldScale.z);
    this.mixer.update(dt);
  }
}

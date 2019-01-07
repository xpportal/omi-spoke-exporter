import THREE from "../../vendor/three";
import EditorNodeMixin from "./EditorNodeMixin";
import Sky from "../objects/Sky";

export default class SkyboxNode extends EditorNodeMixin(Sky) {
  static legacyComponentName = "skybox";

  static hideTransform = true;

  static nodeName = "Skybox";

  static async deserialize(editor, json) {
    const node = await super.deserialize(editor, json);

    const {
      turbidity,
      rayleigh,
      luminance,
      mieCoefficient,
      mieDirectionalG,
      inclination,
      azimuth,
      distance
    } = json.components.find(c => c.name === "skybox").props;

    node.turbidity = turbidity;
    node.rayleigh = rayleigh;
    node.luminance = luminance;
    node.mieCoefficient = mieCoefficient;
    node.mieDirectionalG = mieDirectionalG;
    node.inclination = inclination;
    node.azimuth = azimuth;
    node.distance = distance;

    return node;
  }

  constructor(editor) {
    super(editor);

    this.skyScene = new THREE.Scene();
    this.cubeCamera = new THREE.CubeCamera(1, 100000, 512);
    this.skyScene.add(this.cubeCamera);

    this.updateEnvironmentMap();
  }

  updateEnvironmentMap() {
    this.skyScene.add(this.sky);
    this.cubeCamera.update(this.editor.viewport.renderer, this.skyScene);
    this.add(this.sky);
    this.editor.scene.updateEnvironmentMap(this.cubeCamera.renderTarget.texture);
  }

  onAfterFirstRender() {
    this.updateEnvironmentMap();
  }

  onChange() {
    this.updateEnvironmentMap();
  }

  onRemove() {
    this.editor.scene.updateEnvironmentMap(null);
  }

  serialize() {
    const json = super.serialize();

    json.components.push({
      name: "skybox",
      props: {
        turbidity: this.turbidity,
        rayleigh: this.rayleigh,
        luminance: this.luminance,
        mieCoefficient: this.mieCoefficient,
        mieDirectionalG: this.mieDirectionalG,
        inclination: this.inclination,
        azimuth: this.azimuth,
        distance: this.distance
      }
    });

    return json;
  }

  prepareForExport() {
    const replacementObject = new THREE.Object3D().copy(this, false);

    replacementObject.userData.gltfExtensions = {
      HUBS_components: {
        skybox: {
          turbidity: this.turbidity,
          rayleigh: this.rayleigh,
          luminance: this.luminance,
          mieCoefficient: this.mieCoefficient,
          mieDirectionalG: this.mieDirectionalG,
          inclination: this.inclination,
          azimuth: this.azimuth,
          distance: this.distance
        }
      }
    };

    this.parent.add(replacementObject);
    this.parent.remove(this);
  }
}

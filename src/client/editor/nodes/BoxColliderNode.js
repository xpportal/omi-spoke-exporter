import THREE from "../../vendor/three";
import EditorNodeMixin from "./EditorNodeMixin";

export default class BoxColliderNode extends EditorNodeMixin(THREE.Object3D) {
  static legacyComponentName = "box-collider";

  static nodeName = "Box Collider";

  static _geometry = new THREE.BoxBufferGeometry();

  static _material = new THREE.Material();

  static async deserialize(editor, json) {
    const node = await super.deserialize(editor, json);

    node.walkable = !!json.components.find(c => c.name === "walkable");

    return node;
  }

  constructor(editor) {
    super(editor);

    const boxMesh = new THREE.Mesh(BoxColliderNode._geometry, BoxColliderNode._material);
    const box = new THREE.BoxHelper(boxMesh, 0x00ff00);
    box.layers.set(1);
    this.helper = box;
    this.add(box);
    this.walkable = true;
  }

  copy(source, recursive) {
    super.copy(source, false);

    if (recursive) {
      for (const child of source.children) {
        if (child !== this.helper) {
          const clonedChild = child.clone();
          this.add(clonedChild);
        }
      }
    }

    this.walkable = source.walkable;

    return this;
  }

  serialize() {
    const components = {
      "box-collider": {}
    };

    if (this.walkable) {
      components.walkable = {};
    }

    return super.serialize(components);
  }

  prepareForExport() {
    super.prepareForExport();
    this.remove(this.helper);
    this.addGLTFComponent("box-collider", {
      // TODO: Remove exporting these properties. They are already included in the transform props.
      position: this.position,
      rotation: {
        x: this.rotation.x,
        y: this.rotation.y,
        z: this.rotation.z
      },
      scale: this.scale
    });
  }
}

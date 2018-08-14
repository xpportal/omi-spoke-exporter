import Command from "../Command";

/**
 * @param object THREE.Object3D
 * @param componentName String
 * @constructor
 */

export default class RemoveComponentCommand extends Command {
  constructor(object, componentName) {
    super();
    this.type = "RemoveComponentCommand";
    this.object = object;
    this.componentName = componentName;

    this.name = `Remove ${object.name} Component from ${componentName}.`;
  }

  execute() {
    this.editor._removeComponent(this.object, this.componentName);
    this.editor.removeHelper(this.object);
    this.editor.signals.objectChanged.dispatch(this.object);
  }

  undo() {
    this.editor._addComponent(this.object, this.componentName).then(() => {
      this.editor.signals.objectChanged.dispatch(this.object);
    });
  }
}

import Command from "./Command";
import { serializeObject3D, serializeProperty } from "../utils/debug";

export default class SetPropertyCommand extends Command {
  constructor(editor, object, propertyName, value) {
    super(editor);

    this.object = object;
    this.propertyName = propertyName;

    if (value && value.clone) {
      this.newValue = value.clone();
    } else {
      this.newValue = value;
    }

    const oldValue = this.object[propertyName];

    if (oldValue && oldValue.clone) {
      this.oldValue = oldValue.clone();
    } else {
      this.oldValue = oldValue;
    }
  }

  execute() {
    this.editor.setProperty(this.object, this.propertyName, this.newValue, false);
  }

  shouldUpdate(newCommand) {
    return this.object === newCommand.object && this.propertyName === newCommand.propertyName;
  }

  update(command) {
    const newValue = command.newValue;

    if (newValue && newValue.clone && newValue.copy) {
      this.newValue = newValue.clone();
    } else {
      this.newValue = newValue;
    }

    this.editor.setProperty(this.object, this.propertyName, this.newValue, false);
  }

  undo() {
    this.editor.setProperty(this.object, this.propertyName, this.oldValue, false);
  }

  toString() {
    return `SetPropertyCommand id: ${this.id} object: ${serializeObject3D(this.object)} propertyName: ${
      this.propertyName
    } newValue: ${serializeProperty(this.newValue)}`;
  }
}

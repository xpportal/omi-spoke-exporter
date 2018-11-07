import React, { Component } from "react";
import PropTypes from "prop-types";
import NodeEditor from "./NodeEditor";
import InputGroup from "../inputs/InputGroup";
import ColorInput from "../inputs/ColorInput";
import NumericInput from "../inputs/NumericInput";
import BooleanInput from "../inputs/BooleanInput";

export default class DirectionalLightNodeEditor extends Component {
  static propTypes = {
    editor: PropTypes.object,
    node: PropTypes.object
  };

  static iconClassName = "fa-bolt";

  onChangeColor = color => {
    this.props.editor.setNodeProperty(this.props.node, "color", color);
  };

  onChangeIntensity = intensity => {
    this.props.editor.setNodeProperty(this.props.node, "intensity", intensity);
  };

  onChangeCastShadow = castShadow => {
    this.props.editor.setNodeProperty(this.props.node, "castShadow", castShadow);
  };

  render() {
    const node = this.props.node;

    return (
      <NodeEditor
        {...this.props}
        description="A light which illuminates the entire scene, but emits along a single direction."
      >
        <InputGroup name="Color">
          <ColorInput value={node.color} onChange={this.onChangeColor} />
        </InputGroup>
        <InputGroup name="Intensity">
          <NumericInput min={0} value={node.intensity} onChange={this.onChangeIntensity} />
        </InputGroup>
        <InputGroup name="Cast Shadow">
          <BooleanInput value={node.castShadow} onChange={this.onChangeCastShadow} />
        </InputGroup>
      </NodeEditor>
    );
  }
}

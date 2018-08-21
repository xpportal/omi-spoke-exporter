import React, { Component } from "react";
import PropTypes from "prop-types";
import { SketchPicker } from "react-color";
import { EditableInput } from "react-color/lib/components/common";
import styles from "./ColorInput.scss";
import csscolorNames from "css-color-names";

export default class ColorInput extends Component {
  constructor(props) {
    super(props);
    this.state = {
      targetBlock: null,
      pickerX: 0,
      pickerY: 0,
      displayColorPicker: false
    };
  }

  componentDidMount = () => {
    window.addEventListener("resize", this.updateDimensions);
  };

  componentWillUnmount = () => {
    window.removeEventListener("resize", this.updateDimensions);
  };

  updateDimensions = () => {
    const target = this.state.targetBlock.getBoundingClientRect();
    this.setState({
      pickerX: target.left,
      pickerY: target.y + target.height
    });
  };

  handleClick = e => {
    const target = e.currentTarget.getBoundingClientRect();
    this.setState({
      targetBlock: e.currentTarget,
      pickerX: target.left,
      pickerY: target.y + target.height,
      displayColorPicker: !this.state.displayColorPicker
    });
  };

  handleClose = () => {
    this.setState({ displayColorPicker: false });
  };

  handleColorHexValue = () => {
    const color = this.props.value;
    return csscolorNames[color] ? csscolorNames[color] : color;
  };

  renderColorPicker = () => {
    if (!this.state.displayColorPicker) {
      return null;
    }
    const pos = {
      left: this.state.pickerX,
      top: this.state.pickerY
    };
    return (
      <div style={pos} className={styles.popover}>
        <div className={styles.cover} onClick={this.handleClose} />
        <div className={styles.colorPicker}>
          <SketchPicker
            color={this.props.value}
            disableAlpha={true}
            onChange={color => this.props.onChange(color.hex)}
          />
        </div>
      </div>
    );
  };

  render() {
    return (
      <div className={styles.colorInput}>
        <div className={styles.block} onClick={this.handleClick}>
          <div className={styles.color} style={{ background: this.props.value }} />
        </div>
        <div className={styles.colorInput}>
          <EditableInput value={this.handleColorHexValue()} onChange={color => this.props.onChange(color)} />
        </div>
        {this.renderColorPicker()}
      </div>
    );
  }
}

ColorInput.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func
};

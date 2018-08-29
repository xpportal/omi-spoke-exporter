import React, { Component } from "react";
import PropTypes from "prop-types";
import { HotKeys } from "react-hotkeys";
import Viewport from "../Viewport";
import { withEditor } from "../contexts/EditorContext";
import { withDialog } from "../contexts/DialogContext";
import { withSceneActions } from "../contexts/SceneActionsContext";
import ErrorDialog from "../dialogs/ErrorDialog";
import styles from "./ViewportPanelContainer.scss";
import FileDropTarget from "../FileDropTarget";

class ViewportPanelContainer extends Component {
  static propTypes = {
    editor: PropTypes.object,
    sceneActions: PropTypes.object,
    showDialog: PropTypes.func,
    hideDialog: PropTypes.func
  };

  constructor(props) {
    super(props);

    this.state = {
      viewportHotKeyHandlers: {
        translateTool: this.onTranslateTool,
        rotateTool: this.onRotateTool,
        scaleTool: this.onScaleTool,
        delete: this.onDelete,
        duplicate: this.onDuplicate,
        snapTool: this.onSnapTool,
        spaceTool: this.onSpaceTool
      }
    };

    this.canvasRef = React.createRef();
  }

  componentDidMount() {
    this.props.editor.createViewport(this.canvasRef.current);
  }

  onDropFile = async item => {
    if (item.file) {
      const file = item.file;

      if (file.ext === ".gltf" || file.ext === ".glb") {
        try {
          this.props.editor.addGLTFModelNode(file.name, file.uri);
        } catch (e) {
          this.props.showDialog(ErrorDialog, {
            title: "Error adding model.",
            message: e.message
          });
        }
      }
    }
  };

  onTranslateTool = () => {
    this.props.editor.signals.transformModeChanged.dispatch("translate");
  };

  onRotateTool = () => {
    this.props.editor.signals.transformModeChanged.dispatch("rotate");
  };

  onScaleTool = () => {
    this.props.editor.signals.transformModeChanged.dispatch("scale");
  };

  onDuplicate = e => {
    e.preventDefault();
    this.props.editor.duplicateSelectedObject();
    return false;
  };

  onDelete = e => {
    e.preventDefault();
    this.props.editor.deleteSelectedObject();
  };

  onSnapTool = () => {
    this.props.editor.signals.snapToggled.dispatch();
  };

  onSpaceTool = () => {
    this.props.editor.signals.spaceChanged.dispatch();
  };

  render() {
    return (
      <HotKeys handlers={this.state.viewportHotKeyHandlers} className={styles.viewportPanelContainer}>
        <FileDropTarget onDropFile={this.onDropFile}>
          <Viewport ref={this.canvasRef} onDropFile={this.onDropFile} />
        </FileDropTarget>
      </HotKeys>
    );
  }
}

export default withEditor(withDialog(withSceneActions(ViewportPanelContainer)));

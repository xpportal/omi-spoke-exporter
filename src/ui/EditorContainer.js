import React, { Component } from "react";
import PropTypes from "prop-types";
import { MosaicWindow, Mosaic } from "react-mosaic-component";
import { HotKeys } from "react-hotkeys";
import Modal from "react-modal";
import { Prompt } from "react-router-dom";
import DocumentTitle from "react-document-title";

import styles from "./EditorContainer.scss";

import ToolBar from "./toolbar/ToolBar";

import HierarchyPanelContainer from "./hierarchy/HierarchyPanelContainer";
import PropertiesPanelContainer from "./properties/PropertiesPanelContainer";
import ViewportPanelContainer from "./viewport/ViewportPanelContainer";

import { defaultSettings, SettingsContextProvider } from "./contexts/SettingsContext";
import { EditorContextProvider } from "./contexts/EditorContext";
import { DialogContextProvider } from "./contexts/DialogContext";

import { createEditor } from "../config";

import ErrorDialog from "./dialogs/ErrorDialog";
import ProgressDialog from "./dialogs/ProgressDialog";
import ConfirmDialog from "./dialogs/ConfirmDialog";

function isInputSelected() {
  const el = document.activeElement;
  const nodeName = el.nodeName;
  return el.isContentEditable || nodeName === "INPUT" || nodeName === "SELECT" || nodeName === "TEXTAREA";
}

function wrapHotkeyHandler(component, handler) {
  return e => {
    e.preventDefault();

    // Disable when dialog is shown.
    if (component.state.DialogComponent !== null) {
      return;
    }

    handler();
  };
}

export default class EditorContainer extends Component {
  static propTypes = {
    api: PropTypes.object.isRequired,
    projectId: PropTypes.string.isRequired,
    project: PropTypes.object,
    history: PropTypes.object.isRequired
  };

  constructor(props) {
    super(props);

    window.addEventListener("resize", this.onWindowResize, false);

    let settings = defaultSettings;
    const storedSettings = localStorage.getItem("spoke-settings");
    if (storedSettings) {
      settings = JSON.parse(storedSettings);
    }

    const editor = createEditor(props.api);
    window.editor = editor;
    const editorInitPromise = editor.init();

    this.state = {
      editor,
      editorInitPromise,
      settingsContext: {
        settings,
        updateSetting: this.updateSetting
      },
      registeredPanels: {
        hierarchy: {
          component: HierarchyPanelContainer,
          windowProps: {
            className: "hierarchyPanel",
            title: "Hierarchy",
            toolbarControls: [],
            draggable: false
          }
        },
        viewport: {
          component: ViewportPanelContainer,
          windowProps: {
            className: "viewportPanel",
            title: "Viewport",
            toolbarControls: [],
            draggable: false
          }
        },
        properties: {
          component: PropertiesPanelContainer,
          windowProps: {
            className: "propertiesPanel",
            title: "Properties",
            toolbarControls: [],
            draggable: false
          }
        }
      },
      initialPanels: {
        direction: "row",
        first: "viewport",
        second: {
          direction: "column",
          first: "hierarchy",
          second: "properties",
          splitPercentage: 50
        },
        splitPercentage: 75
      },
      DialogComponent: null,
      dialogProps: {},
      keyMap: {
        translateTool: "w",
        rotateTool: "e",
        scaleTool: "r",
        spaceTool: "d",
        snapTool: "s",
        focusSelection: "f",
        delete: ["del", "backspace"],
        duplicate: ["ctrl+d", "command+d"],
        save: ["ctrl+s", "command+s"],
        open: ["ctrl+o", "command+o"],
        undo: ["ctrl+z", "command+z"],
        redo: ["ctrl+shift+z", "command+shift+z"]
      },
      globalHotKeyHandlers: {
        undo: this.onUndo,
        redo: this.onRedo,
        delete: this.onDelete,
        save: wrapHotkeyHandler(this, this.onSaveProject),
        open: wrapHotkeyHandler(this, this.onOpenProject),
        translateTool: this.onTranslateTool,
        rotateTool: this.onRotateTool,
        scaleTool: this.onScaleTool,
        focusSelection: this.onFocusSelection,
        duplicate: this.onDuplicate,
        snapTool: this.onSnapTool,
        spaceTool: this.onSpaceTool
      }
    };
  }

  generateToolbarMenu = () => {
    return [
      {
        name: "Back to Projects",
        action: this.onOpenProject
      },
      {
        name: "File",
        items: [
          {
            name: "New Project",
            action: this.onNewProject
          },
          {
            name: `Save Project`,
            action: this.onSaveProject
          },
          {
            name: "Publish to Hubs...",
            action: this.onPublishProject
          },
          {
            name: "Export as binary glTF (.glb) ...",
            action: this.onExportProject
          },
          {
            name: "Import legacy .spoke project",
            action: this.onImportLegacyProject
          }
        ]
      },
      {
        name: "Help",
        items: [
          {
            name: "Keyboard and Mouse Controls",
            action: () => window.open("https://github.com/MozillaReality/Spoke/wiki/Keyboard-and-Mouse-Controls")
          },
          {
            name: "Get Support",
            action: () => window.open("https://github.com/MozillaReality/Spoke/blob/master/SUPPORT.md")
          },
          {
            name: "Report an Issue",
            action: () => window.open("https://github.com/MozillaReality/Spoke/issues")
          },
          {
            name: "Join us on Discord",
            action: () => window.open("https://discord.gg/XzrGUY8")
          },
          {
            name: "Terms of Use",
            action: () => window.open("https://github.com/mozilla/hubs/blob/master/TERMS.md")
          },
          {
            name: "Privacy Notice",
            action: () => window.open("https://github.com/mozilla/hubs/blob/master/PRIVACY.md")
          }
        ]
      },
      {
        name: "Developer",
        items: [
          {
            name: this.state.settingsContext.settings.enableExperimentalFeatures
              ? "Disable Experimental Features"
              : "Enable Experimental Features",
            action: () =>
              this.updateSetting(
                "enableExperimentalFeatures",
                !this.state.settingsContext.settings.enableExperimentalFeatures
              )
          }
        ]
      }
    ];
  };

  componentDidMount() {
    this.state.editor.signals.windowResize.dispatch();
    this.state.editor.signals.sceneModified.add(this.onSceneModified);
    this.state.editor.signals.editorError.add(this.onEditorError);

    this.state.editorInitPromise
      .then(() => {
        this.loadProject(this.props.project);
      })
      .catch(e => {
        console.error(e);
      });
  }

  componentDidUpdate(prevProps) {
    const { projectId } = this.props;
    const { projectId: prevProjectId } = prevProps;

    if (projectId !== prevProjectId && this.state.editor.viewport) {
      this.state.editorInitPromise
        .then(() => {
          this.loadProject(this.props.project);
        })
        .catch(e => {
          console.error(e);
        });
    }
  }

  componentWillUnmount() {
    window.removeEventListener("resize", this.onWindowResize, false);
    this.state.editor.signals.sceneModified.remove(this.onSceneModified);
    this.state.editor.signals.editorError.remove(this.onEditorError);
  }

  onWindowResize = () => {
    this.state.editor.signals.windowResize.dispatch();
  };

  onPanelChange = () => {
    this.state.editor.signals.windowResize.dispatch();
  };

  /**
   *  Dialog Context
   */

  showDialog = (DialogComponent, dialogProps = {}) => {
    this.setState({
      DialogComponent,
      dialogProps
    });
  };

  hideDialog = () => {
    this.setState({
      DialogComponent: null,
      dialogProps: {}
    });
  };

  dialogContext = {
    showDialog: this.showDialog,
    hideDialog: this.hideDialog
  };

  /**
   *  Hotkey / Hamburger Menu Handlers
   */
  onUndo = () => {
    if (this.state.DialogComponent !== null) {
      return;
    }

    this.state.editor.undo();
  };

  onRedo = () => {
    if (this.state.DialogComponent !== null) {
      return;
    }

    this.state.editor.redo();
  };

  onTranslateTool = e => {
    if (isInputSelected()) {
      return true;
    }

    e.preventDefault();
    this.state.editor.signals.transformModeChanged.dispatch("translate");
  };

  onRotateTool = e => {
    if (isInputSelected()) {
      return true;
    }

    e.preventDefault();
    this.state.editor.signals.transformModeChanged.dispatch("rotate");
  };

  onScaleTool = e => {
    if (isInputSelected()) {
      return true;
    }

    e.preventDefault();
    this.state.editor.signals.transformModeChanged.dispatch("scale");
  };

  onFocusSelection = e => {
    if (isInputSelected()) {
      return true;
    }

    e.preventDefault();
    this.state.editor.focusSelection();
  };

  onDuplicate = e => {
    if (isInputSelected()) {
      return true;
    }

    e.preventDefault();
    this.state.editor.duplicateSelectedObject();
    return false;
  };

  onDelete = e => {
    if (isInputSelected()) {
      return true;
    }

    e.preventDefault();
    this.state.editor.deleteSelectedObject();
  };

  onSnapTool = e => {
    if (isInputSelected()) {
      return true;
    }

    e.preventDefault();
    this.state.editor.signals.snapToggled.dispatch();
  };

  onSpaceTool = e => {
    if (isInputSelected()) {
      return true;
    }

    e.preventDefault();
    this.state.editor.signals.spaceChanged.dispatch();
  };

  /**
   * Scene Event Handlers
   */

  onEditorError = e => {
    this.showDialog(ErrorDialog, {
      title: e.title || "Error",
      message: e.message || "There was an unknown error."
    });
  };

  onSceneModified = () => {
    this.setState({ toolbarMenu: this.generateToolbarMenu() });
  };

  updateSetting(key, value) {
    const settings = Object.assign(this.state.settingsContext.settings, { [key]: value });
    localStorage.setItem("spoke-settings", JSON.stringify(settings));
    this.setState({
      settingsContext: {
        ...this.state.settingsContext,
        settings
      }
    });
  }

  /**
   *  Project Actions
   */

  async loadProject(project) {
    if (project) {
      this.showDialog(ProgressDialog, {
        title: "Loading Project",
        message: "Loading project..."
      });

      try {
        await this.state.editor.loadProject(project, (dependenciesLoaded, totalDependencies) => {
          const loadingProgress = Math.floor((dependenciesLoaded / totalDependencies) * 100);
          this.showDialog(ProgressDialog, {
            title: "Loading Project",
            message: `Loading project: ${loadingProgress}%`
          });
        });

        this.state.editor.projectId = this.props.projectId;

        this.hideDialog();
      } catch (e) {
        console.error(e);

        this.showDialog(ErrorDialog, {
          title: "Error loading project.",
          message: e.message || "There was an error when loading the project."
        });
      }
    } else {
      await this.state.editor.loadNewScene();
      await this.props.api.saveProject(this.props.projectId, this.state.editor, this.showDialog, this.hideDialog);
      this.state.editor.projectId = this.props.projectId;
    }
  }

  onNewProject = async () => {
    this.props.history.push("/projects/new");
  };

  onOpenProject = () => {
    this.props.history.push("/projects");
  };

  onSaveProject = async () => {
    this.showDialog(ProgressDialog, {
      title: "Saving Project",
      message: "Saving project..."
    });

    try {
      const editor = this.state.editor;
      const result = await this.props.api.saveProject(this.props.projectId, editor, this.showDialog, this.hideDialog);
      editor.sceneModified = false;

      this.hideDialog();

      return result;
    } catch (e) {
      console.error(e);

      this.showDialog(ErrorDialog, {
        title: "Error Saving Project",
        message: e.message || "There was an error when saving the project."
      });

      return null;
    }
  };

  onExportProject = async () => {
    this.showDialog(ProgressDialog, {
      title: "Exporting Project",
      message: "Exporting project..."
    });

    try {
      const editor = this.state.editor;

      const glbBlob = await editor.exportScene();

      this.hideDialog();

      const el = document.createElement("a");
      el.download = editor.scene.name + ".glb";
      el.href = URL.createObjectURL(glbBlob);
      document.body.appendChild(el);
      el.click();
      document.body.removeChild(el);
    } catch (e) {
      console.error(e);

      this.showDialog(ErrorDialog, {
        title: "Error Exporting Project",
        message: e.message || "There was an error when exporting the project."
      });
    }
  };

  onImportLegacyProject = async () => {
    const confirm = await new Promise(resolve => {
      this.showDialog(ConfirmDialog, {
        title: "Import Legacy Spoke Project",
        message: "Warning! This will overwrite your existing scene! Are you sure you wish to continue?",
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false)
      });
    });

    if (!confirm) return;

    this.hideDialog();

    const el = document.createElement("input");
    el.type = "file";
    el.accept = ".spoke";
    el.style.display = "none";
    el.onchange = () => {
      if (el.files.length > 0) {
        const fileReader = new FileReader();
        fileReader.onload = () => {
          const json = JSON.parse(fileReader.result);
          this.loadProject(json);
        };
        fileReader.readAsText(el.files[0]);
      }
    };
    el.click();
  };

  onPublishProject = async () => {
    try {
      await this.props.api.publishProject(this.props.projectId, this.state.editor, this.showDialog, this.hideDialog);
    } catch (e) {
      console.error(e);
      this.showDialog(ErrorDialog, {
        title: "Error Publishing Project",
        message: e.message || "There was an unknown error."
      });
    }
  };

  renderPanel = (panelId, path) => {
    const panel = this.state.registeredPanels[panelId];

    return (
      <MosaicWindow path={path} {...panel.windowProps}>
        <panel.component {...panel.props} />
      </MosaicWindow>
    );
  };

  render() {
    const { DialogComponent, dialogProps, settingsContext } = this.state;
    const { editor } = this.state;
    const toolbarMenu = this.generateToolbarMenu();

    const modified = editor.sceneModified ? "*" : "";

    return (
      <HotKeys keyMap={this.state.keyMap} handlers={this.state.globalHotKeyHandlers} className={styles.editorContainer}>
        <SettingsContextProvider value={settingsContext}>
          <EditorContextProvider value={editor}>
            <DialogContextProvider value={this.dialogContext}>
              <ToolBar menu={toolbarMenu} editor={editor} onPublish={this.onPublishProject} />
              <Mosaic
                className="mosaic-theme"
                renderTile={this.renderPanel}
                initialValue={this.state.initialPanels}
                onChange={this.onPanelChange}
              />
              <Modal
                ariaHideApp={false}
                isOpen={!!DialogComponent}
                onRequestClose={this.hideDialog}
                shouldCloseOnOverlayClick={false}
                className="Modal"
                overlayClassName="Overlay"
              >
                {DialogComponent && <DialogComponent {...dialogProps} hideDialog={this.hideDialog} />}
              </Modal>
              <DocumentTitle title={`${modified}${editor.scene.name} | Spoke by Mozilla`} />
              <Prompt
                message={`${
                  editor.scene.name
                } has unsaved changes, are you sure you wish to navigate away from the page?`}
                when={editor.sceneModified}
              />
            </DialogContextProvider>
          </EditorContextProvider>
        </SettingsContextProvider>
      </HotKeys>
    );
  }
}

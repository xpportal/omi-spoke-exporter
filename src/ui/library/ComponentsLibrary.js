import React, { Component } from "react";
import PropTypes from "prop-types";
import LibraryPanel from "./LibraryPanel";
import LibraryGrid from "./LibraryGrid";
import { withEditor } from "../contexts/EditorContext";
import styles from "./ComponentsLibrary.scss";
import LibraryGridScrollContainer from "./LibraryGridScrollContainer";

class ComponentsLibrary extends Component {
  static propTypes = {
    editor: PropTypes.object.isRequired
  };

  constructor(props) {
    super(props);

    const items = [];

    for (const nodeType of props.editor.nodeTypes) {
      if (!nodeType.canCreate) {
        continue;
      }

      const nodeEditor = props.editor.nodeEditors.get(nodeType);

      items.push({
        id: nodeType.nodeName,
        node: nodeType,
        description: nodeEditor.description,
        iconClassName: nodeEditor.iconClassName
      });
    }

    this.state = {
      items
    };
  }

  onSelect = item => {
    const editor = this.props.editor;
    const node = new item.node(editor);
    editor.addObject(node);
  };

  renderTooltip = nodeName => {
    const item = this.state.items.find(i => i.id === nodeName);
    return item && item.description;
  };

  renderItem = item => {
    return (
      <div className={styles.componentsLibraryItem}>
        <i className={`fas ${item.iconClassName}`} />
        <div>{item.id}</div>
      </div>
    );
  };

  render() {
    return (
      <LibraryPanel>
        <LibraryGridScrollContainer>
          <LibraryGrid
            items={this.state.items}
            onSelect={this.onSelect}
            renderTooltip={this.renderTooltip}
            renderItem={this.renderItem}
          />
        </LibraryGridScrollContainer>
      </LibraryPanel>
    );
  }
}

export default withEditor(ComponentsLibrary);

import React from "react";
import PropTypes from "prop-types";
import { DropTarget } from "react-dnd";
import { NativeTypes } from "react-dnd-html5-backend";
import styles from "./FileDropTarget.scss";

function FileDropTarget({ connectDropTarget, children }) {
  return connectDropTarget(<div className={styles.fileDropTarget}>{children}</div>);
}

FileDropTarget.propTypes = {
  connectDropTarget: PropTypes.func,
  children: PropTypes.node
};

export default DropTarget(
  ["file", NativeTypes.FILE, NativeTypes.URL],
  {
    drop(props, monitor) {
      const item = monitor.getItem();

      if (props.onDropFile) {
        props.onDropFile(item);
      }

      return item;
    }
  },
  (connect, monitor) => ({
    connectDropTarget: connect.dropTarget(),
    isOver: monitor.isOver(),
    canDrop: monitor.canDrop()
  })
)(FileDropTarget);

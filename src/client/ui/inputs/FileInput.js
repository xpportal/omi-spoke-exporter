import React from "react";
import PropTypes from "prop-types";
import ReactTooltip from "react-tooltip";

import styles from "./FileInput.scss";
import Button from "../Button";
import FileDialog from "../dialogs/FileDialog";
import { withEditor } from "../contexts/EditorContext";
import { withDialog } from "../contexts/DialogContext";

function FileInput({ value, isValid, onChange, showDialog, hideDialog, filters, editor }) {
  const project = editor.project;
  const inputStyles = `${styles.fileInput} ${isValid ? "" : styles.invalidPath}`;
  const onClick = () => {
    showDialog(FileDialog, {
      filters,
      onConfirm: src => {
        onChange(src);
        hideDialog();
      }
    });
  };

  return (
    <div className={inputStyles} data-tip={isValid ? "" : "File does not exist"} data-type={isValid ? "" : "error"}>
      <input
        value={(value && project.getRelativeURI(value)) || ""}
        onChange={e => onChange(project.getAbsoluteURI(e.target.value))}
      />
      {isValid ? null : <ReactTooltip />}
      <Button onClick={onClick} />
    </div>
  );
}

FileInput.propTypes = {
  value: PropTypes.string,
  isValid: PropTypes.bool,
  onChange: PropTypes.func,
  showDialog: PropTypes.func.isRequired,
  hideDialog: PropTypes.func.isRequired,
  filters: PropTypes.arrayOf(PropTypes.string),
  editor: PropTypes.object.isRequired
};

FileInput.defaultProps = {
  value: null,
  isValid: true,
  onChange: () => {}
};

export default withEditor(withDialog(FileInput));

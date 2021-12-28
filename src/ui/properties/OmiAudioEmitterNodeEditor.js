import React from "react";
import PropTypes from "prop-types";
import NodeEditor from "./NodeEditor";
import InputGroup from "../inputs/InputGroup";
import AudioInput from "../inputs/AudioInput";
import BooleanInput from "../inputs/BooleanInput";
import { VolumeUp } from "styled-icons/fa-solid/VolumeUp";
import AudioParamsProperties from "./AudioParamsProperties";
import useSetPropertySelected from "./useSetPropertySelected";

export default function OmiAudioEmitterNodeEditor(props) {
  const { editor, node } = props;
  const onChangeSrc = useSetPropertySelected(editor, "src");
  const onChangeControls = useSetPropertySelected(editor, "controls");
  const onChangeAutoPlay = useSetPropertySelected(editor, "autoPlay");
  const onChangeLoop = useSetPropertySelected(editor, "loop");

  return (
    <NodeEditor description={OmiAudioEmitterNodeEditor.description} {...props}>
      <InputGroup name="Audio Url">
        <AudioInput value={node.src} onChange={onChangeSrc} />
      </InputGroup>
      <InputGroup name="Controls" info="Toggle the visibility of the media controls in Hubs.">
        <BooleanInput value={node.controls} onChange={onChangeControls} />
      </InputGroup>
      <InputGroup name="Auto Play" info="If true, the media will play when first entering the scene.">
        <BooleanInput value={node.autoPlay} onChange={onChangeAutoPlay} />
      </InputGroup>
      <InputGroup name="Loop" info="If true the media will loop indefinitely.">
        <BooleanInput value={node.loop} onChange={onChangeLoop} />
      </InputGroup>
      <AudioParamsProperties {...props} />
    </NodeEditor>
  );
}

OmiAudioEmitterNodeEditor.propTypes = {
  editor: PropTypes.object,
  node: PropTypes.object,
  multiEdit: PropTypes.bool
};

OmiAudioEmitterNodeEditor.iconComponent = VolumeUp;

OmiAudioEmitterNodeEditor.description = "Dynamically loads audio.";
import React, { Component } from "react";
import PropTypes from "prop-types";
import { getTemplates } from "../api";
import ProjectModal from "../components/ProjectModal";

export default class ProjectModalContainer extends Component {
  constructor(props) {
    super(props);

    this.state = {
      templates: [],
      recentProjects: localStorage.getItem("recent-projects") || []
    };
  }

  componentDidMount() {
    getTemplates()
      .then(templates => {
        this.setState({
          templates
        });
      })
      .catch(error => {
        throw error;
      });
  }

  onOpenProject = gltfUri => {
    const recentProjects = this.state.recentProjects.concat(gltfUri);
    localStorage.setItem("recent-projects", recentProjects);
  };

  onCreateFromTemplate = gltfUri => {
    this.props.onLoadGLTF(gltfUri);
  };

  render() {
    return (
      <ProjectModal
        templates={this.state.templates}
        recentProjects={this.state.recentProjects}
        onCreateFromTemplate={this.onCreateFromTemplate}
      />
    );
  }
}

ProjectModalContainer.propTypes = {
  onLoadGLTF: PropTypes.func.isRequired
};
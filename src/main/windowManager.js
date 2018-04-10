const {app, BrowserWindow, ipcMain} = require('electron')

const Settings = require('./settings')
const Storage = require('./storage')
const GitHelper = require('./gitHelper')
const SFDX = require('./sfdx')
const { handleError, logp, log } = require('./utilities')
const fs = require('fs')
const features = require('../../scratch_org_features.json')
const prefs = require('../../scratch_org_preferences.json')
const authoriseTask = require('../main/tasks/authorise')

const url = require('url')
const path = require('path')

let scratchOrgWindow
let selectProjectWin
let createFeatureWin
let showPullDifferencesWin

let activeProject

const createWindow = () => 
  new BrowserWindow({
    width: 800, 
    height: 600,
    resizable: false,
    titleBarStyle:'hidden'
  })

const selectScratchOrgDetails = (project) => new Promise((resolve, reject) => {

  const debug = Settings().debugMode

  scratchOrgWindow = createWindow()
  
  scratchOrgWindow.loadURL(url.format({
    pathname: path.join(__dirname, '../../views/createScratchOrg.html'),
    protocol: 'file:',
    slashes: true
  }))

  if (debug)
    scratchOrgWindow.webContents.openDevTools()
  
  scratchOrgWindow.on('closed', () => {
  })

  ipcMain.once('createScratchOrg.getProjectDetails', (event, options) => {
    event.sender.send('createScratchOrg.projectDetails', {project, features, prefs})
  })

  ipcMain.once('createScratchOrg', (event, options) => {
  
    scratchOrgWindow.hide()
    scratchOrgWindow = null
    resolve(options)
  })
})

const selectProject = () => new Promise((resolve, reject) => {

  const debug = Settings().debugMode

  selectProjectWin = createWindow()
  
  selectProjectWin.loadURL(url.format({
    pathname: path.join(__dirname, '../../views/selectProject.html'),
    protocol: 'file:',
    slashes: true
  }))

  if (debug)
    selectProjectWin.webContents.openDevTools()
  
  selectProjectWin.on('closed', () => {
    if (!activeProject) {
      reject('No details were provided')
    }
  })

  ipcMain.once('createProject', (event, project) => {

    if (project.repositoryUsername && project.repositoryPassword) {
      // Seperate out protocol, host, etc
      // User url parser
      const {protocol, host, pathname} = new url.URL(project.repositoryURL)

      project.repositoryURL = `${protocol}//${project.repositoryUsername}:${project.repositoryPassword}@${host}${pathname}`
    } 

    GitHelper.createProject(project)
      .then(() => Storage.addProject(project))
      .then(data => {
        selectProjectWin.hide()
        selectProjectWin = null
        app.relaunch()
        app.exit()
      })
      .catch((e) => console.error(e))
  })
  
  ipcMain.once('setProject', (event, project) => {
    activeProject = project
    selectProjectWin.hide()
    selectProjectWin = null
    GitHelper.openProject(project)
      .then(() => {
        resolve(activeProject)
      })
  })
  
  ipcMain.once('projects', (event, options) => {
    Storage.getProjects()
      .then((projects) => {
        event.sender.send('projects', projects)
      })
  })

  ipcMain.once('createProject.authorise', (event, project) => {
    selectProjectWin.loadURL(authoriseTask.getAuthURL())

    selectProjectWin.webContents.on('will-navigate', (event, url) => {
      if (url.indexOf('adminex://main') > -1) {
        authoriseTask.createAuthorisationFile(project.name, url)
          .then((devHubAlias) => {
            project.devHubAlias = devHubAlias

            console.log('project', project)

            if (project.repositoryUsername && project.repositoryPassword) {
              // Seperate out protocol, host, etc
              // User url parser
              const {protocol, host, pathname} = new url.URL(project.repositoryURL)
        
              project.repositoryURL = `${protocol}//${project.repositoryUsername}:${project.repositoryPassword}@${host}${pathname}`
            }

            return GitHelper.createProject(project)
          })
          .then(() => Storage.addProject(project)) 
          .then(() => {
            activeProject = project
            selectProjectWin.hide()
            selectProjectWin = null
            resolve(project)
          })
      }
    })
  })
})

const createFeature = (project) => new Promise((resolve, reject) => {

  const debug = Settings().debugMode

  createFeatureWin = createWindow()
  
  createFeatureWin.loadURL(url.format({
    pathname: path.join(__dirname, '../../views/createFeature.html'),
    protocol: 'file:',
    slashes: true
  }))

  if (debug)
    createFeatureWin.webContents.openDevTools()
  
  createFeatureWin.on('closed', () => {
    createFeatureWin = null
  })

  ipcMain.once('createFeature', (event, options) => {
    createFeatureWin.hide()
    createFeatureWin = null
    resolve(options)
  })

  ipcMain.once('createFeature.init', (event, options) => {
    SFDX.getOrgList(project)
      .then((orgs) => {
        event.sender.send('createFeature.initResult', {orgs, project, features, prefs })
      })
  })
})

const showPullDifferences = (project, feature, data) => new Promise((resolve, reject) => {
  const debug = Settings().debugMode
  let resolved = false

  showPullDifferencesWin = createWindow()
  
  showPullDifferencesWin.loadURL(url.format({
    pathname: path.join(__dirname, '../../views/pullDifferences.html'),
    protocol: 'file:',
    slashes: true
  }))

  if (debug)
    showPullDifferencesWin.webContents.openDevTools()
  
  showPullDifferencesWin.on('closed', () => {
    showPullDifferencesWin = null
    if (!resolved) {
      resolve({
        status: 'cancel'
      })
    }
  })

  ipcMain.once('diffs', (event, options) => {
    event.sender.send('diffs', {data, feature, project})
  })

  ipcMain.once('diffResult', (event, result) => {
    showPullDifferencesWin.hide()
    resolved = true
    resolve(result)
  })
})

if (ipcMain) {
  ipcMain.on('getHTMLDiff', (event, data) => {
    if (data) {
      GitHelper.getDiffHTML(data)
        .then(diff => diff ? showHTMLDiff(diff) : null)
        .catch(e => handleError("Couldn't show diff", e))
    }  
  })
  
  ipcMain.on('undoFileChanges', (event, file, project, feature) => {
    if (file) {
      log('Starting undoFileChanges', 'Info', file)
      GitHelper.undoFileChanges(feature.name, file.filePath, file.state)
        .then(() => logp('Finished undoFileChanges', 'Info'))
        .then(() => SFDX.pushSource(project, feature))
        .then(() => logp('Finished pushSource', 'Info'))
        .catch(e => handleError('Could not Undo changes', e))
    }  
  })
}

const showHTMLDiff = (diff) => {
  const debug = Settings().debugMode
  let diffWindow = createWindow()

  if (debug)
    diffWindow.webContents.openDevTools()

  diffWindow.loadURL(url.format({
    pathname: path.join(__dirname, '../../views/showDiff.html'),
    protocol: 'file:',
    slashes: true
  }))

  ipcMain.once('getDiff', (event, options) => {
    event.sender.send('diff', diff)
  })

  diffWindow.on('closed', () => {
    diffWindow = null
  })
}


module.exports = {
  selectScratchOrgDetails,
  selectProject,
  createFeature,
  showPullDifferences
}
const sfdx = require('sfdx-node')
require('util.promisify').shim()

const authDevHub = (project) => new Promise((resolve, reject) => {
  const devHubAlias = `${project.name + 'DevHub'}`

  sfdx.auth.webLogin({
    setdefaultdevhubusername: true,
    setalias: devHubAlias
  }).then(() => resolve(devHubAlias))
    .catch(e => reject(e))
}) 

const createScratchOrg = (project, options) => 
  sfdx.org.create({
    targetdevhubusername: project.devHubAlias,
    setalias: options.alias,
    definitionfile: `${project.directory}/${options.location}`
  }).then(result => options)

const openScratchOrg = (options) => 
  sfdx.org.open({
    targetusername: options.alias
  }).then(() => options)

const pushSource = (options) => 
  sfdx.source.push({
    targetusername: options.alias
  })

const getOrgList = (project) =>
  sfdx.org.list()
    .then(data => {
      const devHubOrgs = data.nonScratchOrgs.filter(org => org.alias == project.devHubAlias)
      if (devHubOrgs.length > 0) {
        return data.scratchOrgs
                .filter(org => org.devHubOrgId == devHubOrgs[0].orgId)
                .map(org => org.alias)
      } else {
        return []
      }
    })

module.exports = {
  authDevHub,
  createScratchOrg,
  openScratchOrg,
  pushSource,
  getOrgList
}
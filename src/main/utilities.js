const {Notification, dialog} = require('electron')
const Settings = require('./settings')
const fs = require('fs')
const Constants = require('./constants')

const shell = require('shelljs')

const checkAppMainDirectory = () => {
  if (!fs.existsSync(Constants.MAIN_DIRECTORY)) {
    shell.mkdir('-p', Constants.MAIN_DIRECTORY)
  }
}

const handleError = (msg, err) => {
  const error = err ? err.toString() : 'Unknown'
  log(error, 'Error')
  dialog.showMessageBox({
    type: 'error',
    title: 'An error has occured',
    message: msg,
    detail: error
  })
}

const alert = (msg) => {
  const notification = new Notification({
    title: 'Admin Experience',
    body: msg
  })

  notification.show()
}

const log = (msg, type) => {
  const d = new Date()
  const logMsg = `${d.toISOString()}\t${type ? type : 'Info'}\t${msg}`
  console.log(logMsg)
  appendToLogFile(`${logMsg}\n`)
}

const logp = (msg, type, data) => new Promise((resolve, reject) => {
  const d = typeof data == undefined ? '' : (typeof data == 'string' ? data : JSON.stringify(data))
  const message = `${msg} ${d}`
  log(message, type)
  resolve(data)
})

const logging = Settings().logging

const logFilePath = `${Constants.MAIN_DIRECTORY}/${new Date().toISOString()}.log`

const appendToLogFile = (data) => {
  if (logging) {
    if (fs.existsSync(logFilePath)) {
      fs.appendFile(logFilePath, data, (err) => {
        if (err)
          console.error(err)
      })
    } else {
      fs.writeFile(logFilePath, data, (err) => {
        if (err)
          console.error(err)
      })
    }
  }
}

module.exports = {
  handleError,
  alert,
  log,
  logp,
  checkAppMainDirectory
}
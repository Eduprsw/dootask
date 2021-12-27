const fs = require('fs')
const path = require('path')
const XLSX = require('xlsx');
const {app, BrowserWindow, ipcMain, dialog} = require('electron')

let mainWindow = null,
    subWindow = [],
    willQuitApp = false,
    inheritClose = false,
    devloadCachePath = path.resolve(__dirname, ".devload"),
    devloadUrl = "";
if (fs.existsSync(devloadCachePath)) {
    devloadUrl = fs.readFileSync(devloadCachePath, 'utf8')
}

function runNum(str, fixed) {
    let _s = Number(str);
    if (_s + "" === "NaN") {
        _s = 0;
    }
    if (/^[0-9]*[1-9][0-9]*$/.test(fixed)) {
        _s = _s.toFixed(fixed);
        let rs = _s.indexOf('.');
        if (rs < 0) {
            _s += ".";
            for (let i = 0; i < fixed; i++) {
                _s += "0";
            }
        }
    }
    return _s;
}

function randomString(len) {
    len = len || 32;
    let $chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678oOLl9gqVvUuI1';
    let maxPos = $chars.length;
    let pwd = '';
    for (let i = 0; i < len; i++) {
        pwd += $chars.charAt(Math.floor(Math.random() * maxPos));
    }
    return pwd;
}

function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        center: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: true,
            contextIsolation: false
        }
    })
    mainWindow.webContents.setUserAgent(mainWindow.webContents.getUserAgent() + " MainTaksWindow/1.0");

    if (devloadUrl) {
        mainWindow.loadURL(devloadUrl).then(r => {

        })
    } else {
        mainWindow.loadFile('./public/index.html').then(r => {

        })
    }

    mainWindow.on('close', function (e) {
        if (!willQuitApp) {
            e.preventDefault();
            if (inheritClose) {
                mainWindow.webContents.send("windowClose", {})
            } else {
                app.hide();
            }
        }
    })
}

function createSubWindow(args) {
    if (!args) {
        return;
    }

    if (typeof args !== "object") {
        args = {
            path: args,
            config: {},
        }
    }

    let name = args.name || "auto_" + randomString(6);
    let item = subWindow.find(item => item.name == name);
    let browser = item ? item.browser : null;
    if (browser) {
        browser.focus();
        if (args.force === false) {
            return;
        }
    } else {
        browser = new BrowserWindow(Object.assign({
            width: 1280,
            height: 800,
            center: true,
            parent: mainWindow,
            webPreferences: {
                preload: path.join(__dirname, 'preload.js'),
                devTools: args.devTools !== false,
                nodeIntegration: true,
                contextIsolation: false
            }
        }, args.config || {}))
        browser.on('close', function () {
            let index = subWindow.findIndex(item => item.name == name);
            if (index > -1) {
                subWindow.splice(index, 1)
            }
        })
        subWindow.push({ name, browser })
    }
    browser.webContents.setUserAgent(browser.webContents.getUserAgent() + " SubTaskWindow/1.0" + (args.userAgent ? (" " + args.userAgent) : ""));

    if (devloadUrl) {
        browser.loadURL(devloadUrl + '#' + (args.hash || args.path)).then(r => {

        })
    } else {
        browser.loadFile('./public/index.html', {
            hash: args.hash || args.path
        }).then(r => {

        })
    }
}

app.whenReady().then(() => {
    createMainWindow()

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('before-quit', () => {
    willQuitApp = true
})

ipcMain.on('inheritClose', (event) => {
    inheritClose = true
    event.returnValue = "ok"
})

ipcMain.on('windowRouter', (event, args) => {
    createSubWindow(args)
    event.returnValue = "ok"
})

ipcMain.on('windowHidden', (event) => {
    app.hide();
    event.returnValue = "ok"
})

ipcMain.on('windowClose', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win.close()
    event.returnValue = "ok"
})

ipcMain.on('windowSize', (event, args) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
        if (args.width || args.height) {
            win.setSize(args.width || win.getSize()[0], args.height || win.getSize()[1], args.animate === true)
        }
        if (args.minWidth || args.minHeight) {
            win.setMinimumSize(args.minWidth || win.getMinimumSize()[0], args.minHeight || win.getMinimumSize()[1])
        }
        if (args.maxWidth || args.maxHeight) {
            win.setMaximumSize(args.maxWidth || win.getMaximumSize()[0], args.maxHeight || win.getMaximumSize()[1])
        }
        if (args.center === true) {
            win.center();
        }
    }
    event.returnValue = "ok"
})

ipcMain.on('windowMinSize', (event, args) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
        win.setMinimumSize(args.width || win.getMinimumSize()[0], args.height || win.getMinimumSize()[1])
    }
    event.returnValue = "ok"
})

ipcMain.on('windowMaxSize', (event, args) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
        win.setMaximumSize(args.width || win.getMaximumSize()[0], args.height || win.getMaximumSize()[1])
    }
    event.returnValue = "ok"
})

ipcMain.on('windowCenter', (event, args) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
        win.center();
    }
    event.returnValue = "ok"
})

ipcMain.on('windowMax', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win.isMaximized()) {
        win.restore();
    } else {
        win.maximize();
    }
    event.returnValue = "ok"
})

ipcMain.on('sendForwardMain', (event, args) => {
    if (mainWindow) {
        mainWindow.webContents.send(args.channel, args.data)
    }
    event.returnValue = "ok"
})

ipcMain.on('setDockBadge', (event, args) => {
    if(process.platform !== 'darwin'){
        // Mac only
        return;
    }
    if (runNum(args) > 0) {
        app.dock.setBadge(String(args))
    } else {
        app.dock.setBadge("")
    }
    event.returnValue = "ok"
})

ipcMain.on('saveSheet', (event, data, filename, opts) => {
    const EXTENSIONS = "xls|xlsx|xlsm|xlsb|xml|csv|txt|dif|sylk|slk|prn|ods|fods|htm|html".split("|");
    dialog.showSaveDialog({
        title: 'Save file as',
        defaultPath: filename,
        filters: [{
            name: "Spreadsheets",
            extensions: EXTENSIONS
        }]
    }).then(o => {
        XLSX.writeFile(data, o.filePath, opts);
    });
    event.returnValue = "ok"
})

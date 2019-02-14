const CLIENT_ID = "823146793082-7lgsb7a22pdeilk7vbb8k9ptp7jnfgsm.apps.googleusercontent.com";
const SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/gmail.insert",
  "https://www.googleapis.com/auth/gmail.readonly",
].join(" ");
const DISCOVERY_DOCS = [
  "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest",
  "https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest"
];

const mimeReplacements = {
  "application/msword": ["doc", "application/vnd.google-apps.document"],
  "application/pdf": ["pdf", "application/vnd.google-apps.document"],
  "application/vnd.ms-word.document.macroenabled.12": ["docm", "application/vnd.google-apps.document"],
  "application/vnd.ms-word.template.macroenabled.12": ["dotm", "application/vnd.google-apps.document"],
  "application/vnd.oasis.opendocument.text": ["odt", "application/vnd.google-apps.document"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx", "application/vnd.google-apps.document"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.template": ["dotx", "application/vnd.google-apps.document"],
  "application/vnd.sun.xml.writer": ["sxw", "application/vnd.google-apps.document"],
  "application/x-vnd.oasis.opendocument.text": ["odt", "application/vnd.google-apps.document"],

  "application/vnd.ms-powerpoint": ["ppt", "application/vnd.google-apps.presentation"],
  "application/vnd.ms-powerpoint.presentation.macroenabled.12": ["pptm", "application/vnd.google-apps.presentation"],
  "application/vnd.ms-powerpoint.slideshow.macroenabled.12": ["ppsm", "application/vnd.google-apps.presentation"],
  "application/vnd.ms-powerpoint.template.macroenabled.12": ["potm", "application/vnd.google-apps.presentation"],
  "application/vnd.oasis.opendocument.presentation": ["odp", "application/vnd.google-apps.presentation"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ["pptx", "application/vnd.google-apps.presentation"],
  "application/vnd.openxmlformats-officedocument.presentationml.slideshow": ["ppsx", "application/vnd.google-apps.presentation"],
  "application/vnd.openxmlformats-officedocument.presentationml.template": ["potx", "application/vnd.google-apps.presentation"],
  "application/x-vnd.oasis.opendocument.presentation": ["odp", "application/vnd.google-apps.presentation"],

  "image/bmp":    ["bmp", "application/vnd.google-apps.document"],
  "image/gif":    ["gif", "application/vnd.google-apps.document"],
  "image/jpeg":   ["jpg", "application/vnd.google-apps.document"],
  "image/jpg":    ["jpg", "application/vnd.google-apps.document"],
  "image/pjpeg":  ["jpg", "application/vnd.google-apps.document"],
  "image/png":    ["png", "application/vnd.google-apps.document"],
  "image/x-bmp":  ["bmp", "application/vnd.google-apps.document"],
  "image/x-png":  ["bmp", "application/vnd.google-apps.document"],
};

const initializing = document.getElementById("initializing");
const retrieving = document.getElementById("retrieving");

const main_div = document.getElementById("main");
const auth_div = document.getElementById("auth");
const search_div = document.getElementById("search");
const config_div = document.getElementById("config");

const query_input = document.getElementById("query-input");
const email_count = document.getElementById("email-count");

const StateEnum = {
  INIT: 0,
  AUTH: 1,
  SEARCH: 2,
  SEARCHING: 3,
  SEARCHRES: 4,
  DOCTORING: 5
};
var state;
stateChange(StateEnum.INIT);

var emailList = [];

function handleClientLoad() {
  gapi.load("client:auth2", initClient);
}

function initClient() {
  gapi.client.init({
    clientId: CLIENT_ID,
    discoveryDocs: DISCOVERY_DOCS,
    scope: SCOPES
  }).then(function () {
    const signedin = gapi.auth2.getAuthInstance().isSignedIn.get();
    stateChange(signedin ? StateEnum.SEARCH : StateEnum.AUTH);
  }, function(error) {
    console.log(JSON.stringify(error, null, 2));
  });
}

function signin(event) {
  gapi.auth2.getAuthInstance().signIn();
}

function stateChange(newState) {
  state = newState;

  initializing.style.display = (state === StateEnum.INIT) ? "block" : "none";
  main_div.style.display = (state === StateEnum.INIT) ? "none": "block";
  retrieving.style.display = (state === StateEnum.SEARCHING) ? "block" : "none";

  if (state === StateEnum.AUTH) {
    auth_div.setAttribute("step", "cur");
    search_div.setAttribute("step", "after");
    config_div.setAttribute("step", "after");
  } else if (state === StateEnum.SEARCH) {
    auth_div.setAttribute("step", "before");
    search_div.setAttribute("step", "cur");
    config_div.setAttribute("step", "after");
  } else if (state === StateEnum.SEARCHING) {
    auth_div.setAttribute("step", "before");
    search_div.setAttribute("step", "before");
    config_div.setAttribute("step", "after");
  } else if (state === StateEnum.SEARCHRES) {
    auth_div.setAttribute("step", "before");
    search_div.setAttribute("step", "before");
    config_div.setAttribute("step", "cur");
  }
}

function searchEmails() {
  stateChange(StateEnum.SEARCHING);
  const query = query_input.value;

  const getPageOfMessages = function(request, result) {
    request.then(resp => {
      result = result.concat(resp.result.messages);
      console.log(result.length);
      const nextPageToken = resp.result.nextPageToken;
      if (nextPageToken) {
        request = gapi.client.gmail.users.messages.list({
          'userId': 'me',
          'pageToken': nextPageToken,
          'q': query
        });
        getPageOfMessages(request, result);
      } else {
        emailList = result;
        stateChange(StateEnum.SEARCHRES);
        email_count.innerHTML = `<b>${result.length}</b> emails were found matching your search query.`;
      }
    });
  };
  const initialRequest = gapi.client.gmail.users.messages.list({
    userId: "me",
    q: query
  });
  getPageOfMessages(initialRequest, []);
}

function processEmails() {
  gapi.client.drive.files.create({
    resource: {
      name: "gdoctor",
      mimeType: "application/vnd.google-apps.folder"
    },
    fields: "id"
  }).then(resp => {
    const BATCH_SZ = 10;
    const ROOT_ID = resp.result.id;

    const mainPromise = new Promise((resolve, reject) => {
      const singleBatch = (startIdx) => {
        emailSlice = emailList.slice(startIdx, startIdx + BATCH_SZ);
        for (var i = 0; i < emailSlice.length; i++)
          emailSlice[i] = emailSlice[i].id;
        batchGetMessages(emailSlice).then(messageRaws => {
          batchMakeFolders(emailSlice, ROOT_ID).then(msgToFolder => {
            batchUploadAttachments(messageRaws, msgToFolder).then(resp => {
              batchAddEmails(resp).then(resp => {
              if (startIdx + BATCH_SZ < emailList.length)
                singleBatch(startIdx + BATCH_SZ);
              else
                resolve(resp);
              });
            });
          });
        });
      };
      singleBatch(0);
    });

    mainPromise.then(resp => {
      console.log("main promise done! ", resp);
    });
  });
}

function batchGetMessages(messageIds) {
  return new Promise((resolve, reject) => {
    const batch = gapi.client.newBatch();
    for (var i = 0; i < messageIds.length; i++) {
      batch.add(gapi.client.gmail.users.messages.get({
        userId: "me",
        id: messageIds[i],
        format: "raw",
      }));
    }
    batch.then(respMap => {
      const res = [];
      for (var key in respMap.result)
        res.push(respMap.result[key].result);
      resolve(res);
    });
  });
}

function batchMakeFolders(messageIds, rootFolderId) {
  return new Promise((resolve, reject) => {
    const batch = gapi.client.newBatch();
    for (var i = 0; i < messageIds.length; i++) {
      batch.add(gapi.client.drive.files.create({
        resource: {
          name: messageIds[i],
          mimeType: "application/vnd.google-apps.folder",
          parents: [rootFolderId]
        },
        fields: "id, name"
      }));
    }
    batch.then(respMap => {
      msgToFolder = {};
      for (var key in respMap.result) {
        const res = respMap.result[key].result;
        msgToFolder[res.name] = res.id;
      }
      resolve(msgToFolder);
    });
  });
}

function batchUploadAttachments(messageRaws, msgToFolder) {
  return new Promise((resolve, reject) => {
    // doctoredRaws in order according to messageRaws
    // linksToAdd is msgId -> [ url list ]
    const doctoredRaws = [];
    const linksToAdd = [];

    const folderToIdx = {};
    const reqs = [];

    for (var i = 0; i < messageRaws.length; i++) {
      linksToAdd.push([]);

      const cur = messageRaws[i];
      folderToIdx[msgToFolder[cur.id]] = i;
      doctoredRaws.push(doctorEmail(cur.raw, reqs, msgToFolder[cur.id]));
    }

    const BATCH_SZ = 5;

    const singleBatch = (startIdx) => {
      Promise.all(reqs.slice(startIdx, startIdx + BATCH_SZ)).then(resp => {
        for (var i = 0; i < resp.length; i++) {
          const cur = resp[i].result;
          linksToAdd[folderToIdx[cur.parents[0]]].push(cur.webViewLink);
        }

        if (startIdx + BATCH_SZ >= reqs.length) {
          for (var i = 0; i < messageRaws.length; i++)
            doctorEmail2(doctoredRaws[i], linksToAdd[i]);
          resolve(doctoredRaws);
        } else {
          singleBatch(startIdx + BATCH_SZ);
        }
      });
    }
    singleBatch(0);
  });
}

function batchAddEmails(messageRaws) {
  return new Promise((resolve, reject) => {
    const batch = gapi.client.newBatch();
    for (var i = 0; i < messageRaws.length; i++) {
      batch.add(gapi.client.request({
        path: "gmail/v1/users/me/messages",
        method: "POST",
        params: { uploadType: "multipart" },
        body: {
          raw: emailToBase64(messageRaws[i].join("\r\n"))
        }
      }));
    }
    batch.then(respMap => {
      resolve(respMap);
    });
  });
}

function doctorEmail(rawEmail, reqs, folderId) {
  var rawLines = emailFromBase64(rawEmail).split("\r\n");
  const leaves = [];
  getLeafTypes(rawLines, 0, rawLines.length, leaves);

  for (var i = leaves.length - 1; i >= 0; i--) {
    if (leaves[i].type in mimeReplacements) {
      const removed = rawLines.splice(leaves[i].start, leaves[i].end - leaves[i].start, "gdoctored");
      const fileName = `attachment${i}.${mimeReplacements[leaves[i].type][0]}`;
      const mimeType = mimeReplacements[leaves[i].type][1];
      reqs.push(uploadBase64(removed.join(''), mimeType, fileName, folderId));
    }
  }
  return rawLines;
}

function doctorEmail2(rawLines, links) {
  const leaves = [];
  getLeafTypes(rawLines, 0, rawLines.length, leaves);

  const linkToHtml = (url, text) => {
    return `<a href="${url}">${text}</a>`;
  };

  const linkHtmls = new Array(links.length);
  for (var i = 0; i < links.length; i++)
    linkHtmls[i] = linkToHtml(links[i], `Attachment ${i}`);

  for (var i = leaves.length - 1; i >= 0; i--) {
    if (leaves[i].type !== "text/html") continue;
    const encoding = leaves[i].transferEncoding;
    const bodySlice = rawLines.slice(leaves[i].start, leaves[i].end);

    // we only handle base64, quoted, 7bit, 8bit
    if (encoding === "base64") {
      const body = atob(bodySlice.join(''));
      const allLinks = linkHtmls.join('<br>');
      const newLines = chunk(btoa(body + allLinks), 76, "");
      rawLines.splice(leaves[i].start, leaves[i].end - leaves[i].start, ...newLines);
    } else if (encoding == "quoted") {
      // replace equals sign with escaped equals sign
      const allLinks = linkHtmls.join('<br>').replace(/=/g, "=3D");
      const newLines = chunk(allLinks, 75, "=");
      newLines.unshift("");
      rawLines.splice(leaves[i].end, 0, ...newLines);
    } else {
      rawLines.splice(leaves[i].end, 0, ...linkHtmls, "");
    }
  }
}

function chunk(str, size, suffix) {
  const numChunks = Math.ceil(str.length / size);
  const chunks = new Array(numChunks);

  for (let i = 0, o = 0; i < numChunks; ++i, o += size) {
    chunks[i] = str.substr(o, size);
    if (i + 1 < numChunks) chunks[i] += suffix;
  }
  return chunks;
}

function emailFromBase64(b64url) {
  return atob(b64url.replace(/\-/g, '+').replace(/\_/g, '/'));
}

function emailToBase64(raw) {
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_');
}

function getLeafTypes(rawEmailLines, start, end, resList) {
  var headerIdx = start;
  for (; headerIdx < end; headerIdx++)
    if (rawEmailLines[headerIdx].length === 0)
      break;
  // from what I've seen at https://mailformat.dan.info,
  // <header> <newline> is invalid; need at least another line after
  if (headerIdx + 1 >= end) {
    console.error("couldn't find body, all head");
    return;
  }

  var contentType = "";
  for (var i = start; i < headerIdx; i++) {
    // https://stackoverflow.com/questions/6143549: headers not case sensitive
    if (rawEmailLines[i].toLowerCase().startsWith("content-type")) {
      contentType = getHeaderLine(rawEmailLines, i);
      break;
    }
  }

  const mimeType = parseMimeType(contentType);
  if (mimeType.startsWith("multipart")) {
    const boundary = "--" + parseMimeBoundary(contentType);
    const closeBoundary = boundary + "--";

    const splits = [];
    for (var i = headerIdx + 1; i < end; i++) {
      if (rawEmailLines[i] === boundary)
        splits.push(i);
      if (rawEmailLines[i] === closeBoundary) {
        splits.push(i);
        break;
      }
    }
    if (splits.length < 2) {
      console.error("Invalid multipart MIME format");
      return;
    }
    for (var i = 0; i + 1 < splits.length; i++)
      getLeafTypes(rawEmailLines, splits[i] + 1, splits[i + 1], resList);
  } else {
    resList.push({
      start: headerIdx + 1,
      end: end,
      type: mimeType,
      transferEncoding: parseTransferEncoding(rawEmailLines, start, headerIdx)
    });
  }
}

// given a string that starts with "content-type", get its content type
// return it in lower case
function parseMimeType(contentType) {
  const trimStart = "content-type:".length;
  contentType = contentType.substring(trimStart);
  const semicolonIdx = contentType.indexOf(";");
  if (semicolonIdx !== -1)
    contentType = contentType.substring(0, semicolonIdx);
  return contentType.trim().toLowerCase();
}

function parseMimeBoundary(contentType) {
  const targ = "boundary=";
  const boundaryIdx = contentType.toLowerCase().indexOf(targ);
  contentType = contentType.substring(boundaryIdx + targ.length);
  const semicolonIdx = contentType.indexOf(";");
  if (semicolonIdx !== -1)
    contentType = contentType.substring(0, semicolonIdx);
  // if it's like content-type: "asd" return asd
  if (contentType[0] === "\"" && contentType[contentType.length - 1] === "\"")
    return contentType.substring(1, contentType.length - 1);
  return contentType;
}

// our search range is [start, end)
function parseTransferEncoding(rawEmailLines, start, end) {
  for (var i = start; i < end; i++) {
    // https://www.w3.org/Protocols/rfc1341/5_Content-Transfer-Encoding.html
    if (rawEmailLines[i].toLowerCase().startsWith("content-transfer-encoding")) {
      const transferLine = getHeaderLine(rawEmailLines, i).toLowerCase();
      if (transferLine.includes("base64")) return "base64";
      if (transferLine.includes("quoted-printable")) return "quoted";
      if (transferLine.includes("7bit")) return "7bit";
      if (transferLine.includes("8bit")) return "8bit";
      if (transferLine.includes("binary")) return "binary";
      return null;
    }
  }
  return null;
}

// https://tools.ietf.org/html/rfc2822, section 2.2.3: header unfolding
// begin at line start and go until we find a line that doesn't start with whitespace
function getHeaderLine(rawEmailLines, start) {
  var res = rawEmailLines[start];
  for (var i = start + 1; ; i++) {
    const cur = rawEmailLines[i];
    if (cur.length > 0 && (cur[0] === " " || cur[0] === "\t"))
      res += rawEmailLines[i];
    else
      return res;
  }
  return res;
}

function uploadBase64(base64File, mimeType, filename, parentId) {
  const BOUNDARY = "--ASD_ASD_ASD_123456789_987654321_YUH_YUH";
  const metadata = {
    name: filename,
    mimeType: mimeType,
    parents: [parentId]
  };

  return gapi.client.request({
    path: "upload/drive/v3/files",
    method: "POST",
    params: {
      uploadType: "multipart",
      fields: "parents, webViewLink"
    },
    headers: {
      "Content-type": `multipart/related; boundary=${BOUNDARY}`,
    },
    body: formatMultipartBody(mimeType, metadata, base64File, BOUNDARY)
  });
}

function formatMultipartBody(mimeType, metadata, base64Data, BOUNDARY) {
  // thank you to:
  // 1. https://stackoverflow.com/questions/51559203
  // 2. https://stackoverflow.com/questions/33842963
  const delimiter = "\r\n--" + BOUNDARY + "\r\n";
  const closeDelimiter = "\r\n--" + BOUNDARY + "--";
  const body =
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: ' + mimeType + '\r\n' +
    'Content-Transfer-Encoding: base64\r\n' +
    '\r\n' +
    base64Data +
    closeDelimiter;
  return body;
}

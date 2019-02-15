const CLIENT_ID = "823146793082-7lgsb7a22pdeilk7vbb8k9ptp7jnfgsm.apps.googleusercontent.com";
const SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.labels"
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
const search_res_div = document.getElementById("search-res");
const config_div = document.getElementById("config");
const doctoring_div = document.getElementById("doctoring");
const done_div = document.getElementById("done");

const query_input = document.getElementById("query-input");
const email_count = document.getElementById("email-count");
const interbatch = document.getElementById("interbatch");
const intrabatch = document.getElementById("intrabatch");

const label_ons = [
  document.getElementById("oldlabel-on"),
  document.getElementById("newlabel-on")
];
const label_ins = [
  document.getElementById("oldlabel"),
  document.getElementById("newlabel")
];
toggleInput(0);
toggleInput(1);

const StateEnum = {
  INIT: 0,
  AUTH: 1,
  SEARCH: 2,
  SEARCHING: 3,
  SEARCHRES: 4,
  CONFIG: 5,
  DOCTORING: 6,
  DONE: 7
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

    gapi.auth2.getAuthInstance().isSignedIn.listen((isSignedIn) => {
      if (isSignedIn && state === StateEnum.AUTH)
        stateChange(StateEnum.SEARCH);
    });
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

  const setStep = (div, divState) => {
    if (divState < state)
      div.setAttribute("step", "before");
    if (divState === state)
      div.setAttribute("step", "cur");
    if (divState > state)
      div.setAttribute("step", "after");
  }

  setStep(auth_div, StateEnum.AUTH);
  setStep(search_div, StateEnum.SEARCH);
  setStep(search_res_div, StateEnum.SEARCHRES);
  setStep(config_div, StateEnum.CONFIG);
  setStep(doctoring_div, StateEnum.DOCTORING);
  setStep(done_div, StateEnum.DONE);

  if (state === StateEnum.SEARCHRES)
    search_div.setAttribute("step", "cur");
}

function toggleInput(which) {
  const val = label_ons[which].checked;
  if (val) label_ins[which].removeAttribute("disabled");
  else label_ins[which].setAttribute("disabled", "");
}

function searchEmails() {
  stateChange(StateEnum.SEARCHING);
  const query = query_input.value;

  const getPageOfMessages = function(request, result) {
    request.then(resp => {
      var done = !("messages" in resp.result);
      if (!done) {
        result = result.concat(resp.result.messages);
        const nextPageToken = resp.result.nextPageToken;
        if (nextPageToken) {
          request = gapi.client.gmail.users.messages.list({
            userId: "me",
            pageToken: nextPageToken,
            q: query,
            maxResults: 500
          });
          getPageOfMessages(request, result);
        } else {
          done = true;
        }
      }
      if (done) {
        emailList = result;
        stateChange(StateEnum.SEARCHRES);
        email_count.innerHTML = `<b>${result.length}</b> emails were found matching your search query.`;
      }
    });
  };
  const initialRequest = gapi.client.gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults: 500
  });
  getPageOfMessages(initialRequest, []);
}

function processEmails() {
  stateChange(StateEnum.DOCTORING);
  const oldlabel = label_ins[0].value;
  const newlabel = label_ins[1].value;
  const oldLabelEnabled = label_ons[0].checked;
  const newLabelEnabled = label_ons[1].checked;

  readAndCreateLabel(oldlabel, oldLabelEnabled).then(oldLabelId => {
    readAndCreateLabel(newlabel, newLabelEnabled).then(newLabelId => {
      gapi.client.drive.files.create({
        resource: {
          name: "gdoctor",
          mimeType: "application/vnd.google-apps.folder"
        },
        fields: "id"
      }).then(rootFolderResp => {
        const BATCH_SZ = 10;
        const ROOT_ID = rootFolderResp.result.id;

        const mainPromise = new Promise((resolve, reject) => {
          const singleBatch = (startIdx) => {
            const endIdx = Math.min(startIdx + BATCH_SZ, emailList.length);
            interbatch.innerHTML = `Processing emails ${startIdx + 1} - ${endIdx} out of ${emailList.length}`;
            intrabatch.innerHTML = "Downloading emails";

            var emailSlice = emailList.slice(startIdx, startIdx + BATCH_SZ);
            const threadSlice = new Array(emailSlice.length);
            for (var i = 0; i < emailSlice.length; i++) {
              threadSlice[i] = emailSlice[i].threadId;
              emailSlice[i] = emailSlice[i].id;
            }

            batchGetMessages(emailSlice).then(messageRaws => {
              intrabatch.innerHTML = "Making Google Drive folders";
              batchMakeFolders(emailSlice, ROOT_ID).then(msgToFolder => {
                intrabatch.innerHTML = "Uploading attachments to Google Drive";
                batchUploadAttachments(messageRaws, msgToFolder).then(messageRaws => {
                  intrabatch.innerHTML = "Uploading doctored emails to Gmail";
                  batchAddEmails(messageRaws, threadSlice, newLabelId).then(resp => {
                    intrabatch.innerHTML = "Updating labels of original emails";
                    batchLabelOldEmails(emailSlice, oldLabelId).then(resp2 => {
                      if (startIdx + BATCH_SZ < emailList.length)
                        singleBatch(startIdx + BATCH_SZ);
                      else
                        resolve(resp);
                    });
                  });
                });
              });
            });
          };
          singleBatch(0);
        });

        mainPromise.then(resp => {
          stateChange(StateEnum.DONE);
        });
      });
    });
  });
}

function readAndCreateLabel(labelName, enabled) {
  return new Promise((resolve, reject) => {
    if (!enabled) {
      resolve("");
      return;
    }

    gapi.client.gmail.users.labels.list({
      userId: "me"
    }).then(resp => {
      const labels = resp.result.labels;
      for (var i = 0; i < labels.length; i++)
        if (labels[i].name === labelName) {
          resolve(labels[i].id);
          return;
        }
      // we need to create the label since it doesn't exist
      gapi.client.gmail.users.labels.create({
        userId: "me",
        resource: {
          labelListVisibility: "labelHide",
          messageListVisibility: "show",
          name: labelName
        }
      }).then(resp => {
        resolve(resp.result.id);
      });
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
    // we used to keep gapi promise objects in reqs, but now we keep
    // the parameters passed to uploadBase64 to create the req object
    // this is needed because when we retry we need a new promise;
    // the old one has already been resolved and won't re-run
    const reqs = [];
    // so in case of error we can associate the request to the email
    const req_messageIds = [];

    for (var i = 0; i < messageRaws.length; i++) {
      linksToAdd.push([]);

      const cur = messageRaws[i];
      folderToIdx[msgToFolder[cur.id]] = i;
      doctoredRaws.push(doctorEmail(cur.raw, reqs, req_messageIds, msgToFolder[cur.id]));
    }

    const BATCH_SZ = 5;

    const singleBatch = (startIdx) => {
      var curReqs = [];
      var rateLimitedReqs = [];
      const failedRelIdxs = new Set();

      const pushProtectedReq = (idx, relIdx) => {
        curReqs.push(uploadBase64(...reqs[idx]).then(undefined, err => {
          console.log(err);
          failedRelIdxs.add(relIdx);
          if (err.status === 403) {
            rateLimitedReqs.push(idx);
          } else {
            const searchQuery = "rfc822msgid:" + req_messageIds[idx];
            console.error(`Error ${err.status} from attachment ${reqs[idx][2]}; search ${searchQuery} in Gmail to see the original email`);
          }
        }));
      };

      for (var i = 0; i < BATCH_SZ && startIdx + i < reqs.length; i++)
        pushProtectedReq(startIdx + i, i);

      const singleBatchTry = (msWait) => {
        Promise.all(curReqs).then(resp => {
          for (var i = 0; i < resp.length; i++) {
            // this one returned an error, skip it
            if (failedRelIdxs.has(i)) continue;
            const cur = resp[i].result;
            linksToAdd[folderToIdx[cur.parents[0]]].push(cur.webViewLink);
          }
          if (rateLimitedReqs.length > 0) {
            curReqs = [];
            failedRelIdxs.clear();
            for (var i = 0; i < rateLimitedReqs.length; i++)
              pushProtectedReq(rateLimitedReqs[i], i);
            rateLimitedReqs = [];
            // exponential backoff for rate limit stuff
            setTimeout(singleBatchTry, msWait, 1.5 * msWait);
          } else {
            if (startIdx + BATCH_SZ >= reqs.length) {
              for (var i = 0; i < messageRaws.length; i++)
                doctorEmail2(doctoredRaws[i], linksToAdd[i]);
              resolve(doctoredRaws);
            } else {
              singleBatch(startIdx + BATCH_SZ);
            }
          }
        });
      }
      singleBatchTry(500);
    }
    singleBatch(0);
  });
}

function batchAddEmails(messageRaws, threadIds, labelId) {
  return new Promise((resolve, reject) => {
    const batch = gapi.client.newBatch();
    for (var i = 0; i < messageRaws.length; i++) {
      batch.add(gapi.client.request({
        path: "gmail/v1/users/me/messages",
        method: "POST",
        params: {
          // otherwise all emails seem like they arrived just now
          internalDateSource: "dateHeader",
          uploadType: "multipart"
        },
        body: {
          raw: emailToBase64(messageRaws[i].join("\r\n")),
          labelIds: (labelId !== "") ? [labelId] : [],
          threadId: threadIds[i]
        }
      }));
    }
    batch.then(respMap => {
      resolve(respMap);
    });
  });
}

function batchLabelOldEmails(messageIds, labelId) {
  return new Promise((resolve, reject) => {
    if (labelId === "") {
      resolve();
      return;
    }

    gapi.client.gmail.users.messages.batchModify({
      userId: "me",
      resource: {
        ids: messageIds,
        addLabelIds: [labelId]
      }
    }).then(resp => {
      resolve(resp);
    });
  });
}

function doctorEmail(rawEmail, reqs, req_messageIds, folderId) {
  var rawLines = emailFromBase64(rawEmail).split("\r\n");
  const leaves = [];
  getLeafTypes(rawLines, 0, rawLines.length, leaves);

  for (var i = leaves.length - 1; i >= 0; i--) {
    if (leaves[i].type in mimeReplacements) {
      const removed = rawLines.splice(leaves[i].start, leaves[i].end - leaves[i].start, "gdoctored");
      const fileExt = mimeReplacements[leaves[i].type][0];
      const filename = leaves[i].filename.endsWith(fileExt) ? leaves[i].filename : `attachment${i}.${fileExt}`;
      const mimeType = mimeReplacements[leaves[i].type][1];
      reqs.push([removed.join(''), mimeType, filename, folderId]);
      req_messageIds.push(leaves[i].messageId);
    } else if (leaves[i].type !== "text/plain" && leaves[i].type !== "text/html") {
      // it's definitely not the email body since not text or html
      // we can't convert it to Google Doc, so just upload it
      const removed = rawLines.splice(leaves[i].start, leaves[i].end - leaves[i].start, "gdoctored");
      const filename = (leaves[i].filename.length > 0) ? leaves[i].filename : `attachment${i}`;
      reqs.push([removed.join(''), leaves[i].type, filename, folderId]);
      req_messageIds.push(leaves[i].messageId);
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
    if (leaves[i].type !== "text/html" && leaves[i].type !== "text/plain") continue;
    const newline = (leaves[i].type === "text/html") ? "<br>" : "\r\n";
    const linkTexts = (leaves[i].type === "text/html") ? linkHtmls : links;

    const encoding = leaves[i].transferEncoding;
    const bodySlice = rawLines.slice(leaves[i].start, leaves[i].end);

    // we only handle base64, quoted, 7bit, 8bit
    if (encoding === "base64") {
      const body = atob(bodySlice.join(''));
      const allLinks = linkTexts.join(newline);
      const newLines = chunk(btoa(body + allLinks), 76, "");
      rawLines.splice(leaves[i].start, leaves[i].end - leaves[i].start, ...newLines);
    } else if (encoding == "quoted") {
      // replace equals sign with escaped equals sign
      const allLinks = linkTexts.join(newline).replace(/=/g, "=3D");
      const newLines = chunk(allLinks, 75, "=");
      newLines.unshift("");
      rawLines.splice(leaves[i].end, 0, ...newLines);
    } else {
      rawLines.splice(leaves[i].end, 0, ...linkTexts, "");
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

  var mimeType = parseMimeType(contentType);
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
    const filename = parseFilename(rawEmailLines, start, headerIdx);
    // attempt to get file type from file extension if application/octet-stream
    if (mimeType === "application/octet-stream")
      for (var key in mimeReplacements)
        if (filename.endsWith(mimeReplacements[key][0])) {
          mimeType = key;
          break;
        }
    resList.push({
      start: headerIdx + 1,
      end: end,
      type: mimeType,
      transferEncoding: parseTransferEncoding(rawEmailLines, start, headerIdx),
      filename: filename,
      messageId: parseMessageId(rawEmailLines, start, headerIdx)
    });
  }
}

function unquoteIfNeeded(str) {
  if (str[0] === "\"" && str[str.length - 1] === "\"")
    return str.substring(1, str.length - 1);
  return str;
}

// if the string contains a semicolon, remove it and all that's after it
function trimSemicolon(str) {
  const semicolonIdx = str.indexOf(";");
  if (semicolonIdx !== -1)
    return str.substring(0, semicolonIdx);
  return str;
}

// given a string that starts with "content-type", get its content type
// return it in lower case
function parseMimeType(contentType) {
  const trimStart = "content-type:".length;
  contentType = contentType.substring(trimStart);
  return trimSemicolon(contentType).trim().toLowerCase();
}

function parseMimeBoundary(contentType) {
  const targ = "boundary=";
  const boundaryIdx = contentType.toLowerCase().indexOf(targ);
  contentType = contentType.substring(boundaryIdx + targ.length);
  return unquoteIfNeeded(trimSemicolon(contentType));
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

function parseFilename(rawEmailLines, start, end) {
  for (var i = start; i < end; i++) {
    if (rawEmailLines[i].toLowerCase().startsWith("content-disposition")) {
      const disposition = getHeaderLine(rawEmailLines, i).toLowerCase();
      const targ = "filename=";
      const targIdx = disposition.indexOf(targ);
      if (targIdx === -1) return "";
      const res = trimSemicolon(disposition.substring(targIdx + targ.length));
      if (res.length === 0) return "";
      return unquoteIfNeeded(res);
    }
  }
  return "";
}

function parseMessageId(rawEmailLines, start, end) {
  const targ = "message-id:"
  for (var i = start; i < end; i++) {
    if (rawEmailLines[i].toLowerCase().startsWith(targ)) {
      const messageId = getHeaderLine(rawEmailLines, i).toLowerCase();
      return messageId.substring(targ.length).trim();
    }
  }
  return "";
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

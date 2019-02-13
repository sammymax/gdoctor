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

var stage = 0;
const signin_status = document.getElementById("signin-status");
const signin_button = document.getElementById("signin-button");
const query_input = document.getElementById("query-input");

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

function executePromisesSequentially(promiseList) {
  _executePromisesSequentially(promiseList, 0);
}

// returns a promise
function _executePromisesSequentially(promiseList, idx) {
  console.log("info ", idx, promiseList.length);
  if (idx === promiseList.length)
    promiseList[idx].execute();
  else
    promiseList[idx].then(
      resp => _executePromisesSequentially(promiseList, idx + 1),
      err  => _executePromisesSequentially(promiseList, idx)
    );
}

function handleClientLoad() {
  gapi.load("client:auth2", initClient);
}

function initClient() {
  gapi.client.init({
    clientId: CLIENT_ID,
    discoveryDocs: DISCOVERY_DOCS,
    scope: SCOPES
  }).then(function () {
    // Listen for sign-in state changes.
    gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);

    // Handle the initial sign-in state.
    updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
  }, function(error) {
    console.log(JSON.stringify(error, null, 2));
  });
}

function updateSigninStatus(isSignedIn) {
  if (!isSignedIn) return;

  stage = 1;

  signin_status.innerHTML = "Signed in";
  signin_button.style.display = "none";
}

function signin(event) {
  gapi.auth2.getAuthInstance().signIn();
}

function searchEmails() {
  const query = query_input.value;

  const getPageOfMessages = function(request, result) {
    request.then(resp => {
      result = result.concat(resp.result.messages);
      console.log(result.length);
      const nextPageToken = resp.result.nextPageToken;
      //if (nextPageToken) {
      //  request = gapi.client.gmail.users.messages.list({
      //    'userId': 'me',
      //    'pageToken': nextPageToken,
      //    'q': query
      //  });
      //  getPageOfMessages(request, result);
      //} else
        processEmails(result);
    });
  };
  const initialRequest = gapi.client.gmail.users.messages.list({
    userId: "me",
    q: query
  });
  getPageOfMessages(initialRequest, []);
}

function processEmails(emailList) {
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
              //if (startIdx + BATCH_SZ < emailList.length)
              //  singleBatch(startIdx + BATCH_SZ);
              //else
                resolve(resp);
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
    const batch = gapi.client.newBatch();
    doctorEmail(messageRaws[0].raw, batch, msgToFolder[messageRaws[0].id]);
    //const batch = gapi.client.newBatch();
    //const doctoredRaws = [];
    //for (var i = 0; i < messageRaws.length; i++) {
    //  const folderId = msgToFolder[messageRaws[i].id];
    //  doctoredRaws.push(doctorEmail(messageRaws[i].raw, batch, folderId));
    //}

    //batch.then(respMap => {
    //  resolve({
    //    doctoredRaws: doctoredRaws,
    //    respMap: respMap
    //  });
    //}, err => {
    //  console.log("batchup err ", err);
    //});
  });
}

function doctorEmail(rawEmail, batchObj, folderId) {
  var rawLines = emailFromBase64(rawEmail).split("\r\n");
  const leaves = [];
  getLeafTypes(rawLines, 0, rawLines.length, leaves);

  for (var i = leaves.length - 1; i >= 0; i--) {
    if (leaves[i].type in mimeReplacements) {
      const removed = rawLines.splice(leaves[i].start, leaves[i].end - leaves[i].start, "gdoctored");
      const fileName = `attachment${i}.${mimeReplacements[leaves[i].type][0]}`;
      const mimeType = mimeReplacements[leaves[i].type][1];
      //batchObj.add(uploadBase64(removed.join(''), mimeType, fileName, folderId));
      uploadBase64(removed.join(''), mimeType, fileName, folderId).then(resp => {
        console.log("ya ", resp);
      }, err => {
        console.log("er ", err);
      });
    }
  }
  return rawLines;
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
      contentType = rawEmailLines[i];
      for (var j = i + 1; j < headerIdx; j++) {
        // https://tools.ietf.org/html/rfc2822, section 2.2.3: header unfolding
        if (rawEmailLines[j][0] === " " || rawEmailLines[j][0] === "\t")
          contentType += rawEmailLines[j];
        else
          break;
      }
      break;
    }
  }

  const mimeType = parseMimeType(contentType);
  if (mimeType.toLowerCase().startsWith("multipart")) {
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
      type: mimeType
    });
  }
}

// given a string that starts with "content-type", get its content type
function parseMimeType(contentType) {
  const trimStart = "content-type:".length;
  contentType = contentType.substring(trimStart);
  const semicolonIdx = contentType.indexOf(";");
  if (semicolonIdx !== -1)
    contentType = contentType.substring(0, semicolonIdx);
  return contentType.trim();
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

function rawBodySubstitute(rawEmail) {
  var lines = rawEmail.split("\r\n");
  res = [];
  getLeafTypes(lines, 0, lines.length, res);
  console.log(res);
  for (var i = res.length - 1; i >= 0; i--) {
    if (res[i].type in mimeReplacements) {
      const removed = lines.splice(res[i].start, res[i].end - res[i].start, "lolol");
      const fileExtension = mimeReplacements[res[i].type][0];
      const mimeType = mimeReplacements[res[i].type][1];
      uploadBase64(removed.join(''), mimeType, `attachment${i}.${fileExtension}`);
    }
  }
  newEmail = emailToBase64(lines.join("\r\n"));
  gapi.client.request({
    path: "gmail/v1/users/me/messages",
    method: "POST",
    params: { uploadType: "multipart" },
    body: {
      raw: newEmail
    }
  }).then(
    resp => console.log("yayy, ", resp),
    err  => console.log("errr, ", err)
  );
}

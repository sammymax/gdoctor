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

var mimeReplacements = {};

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
  getMimeReplacements();

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
  const queryMsg = (msgId) => {
    return gapi.client.gmail.users.messages.get({
      userId: "me",
      id: msgId,
      format: "raw"
    });
  };
  const queryThread = (threadId) => {
    return gapi.client.gmail.users.threads.get({
      userId: "me",
      id: threadId,
    });
  };

  const BATCH_SZ = 50;

  const batcher = (idxToReq) => {
    return new Promise((resolve, reject) => {
      const res = [];
      const singleBatch = (startIdx) => {
        const batch = gapi.client.newBatch();
        for (var i = 0; startIdx + i < emailList.length && i < BATCH_SZ; i++)
          batch.add(idxToReq(startIdx + i));
        batch.then(respMap => {
          for (var key in respMap.result)
            res.push(respMap.result[key].result);
          if (startIdx + BATCH_SZ < emailList.length)
            singleBatch(startIdx + BATCH_SZ);
          else
            resolve(res);
        });
      }
      singleBatch(0);
    });
  }
  msgPromise = batcher(idx => queryMsg(emailList[idx]["id"]));
  threadPromise = batcher(idx => queryThread(emailList[idx]["threadId"]));
  msgPromise.then(res => {
    console.log(res[0]);
    rawBodySubstitute(emailFromBase64(res[0].raw));
    //threadPromise.then(res2 => {
    //  console.log(res2);
    //});
  });
}

function emailFromBase64(b64url) {
  return atob(b64url.replace(/\-/g, '+').replace(/\_/g, '/'));
}

function emailToBase64(raw) {
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_');
}

function rawBodySubstitute(rawEmail) {
  var lines = rawEmail.split("\r\n");
  res = [];
  getLeafTypes(lines, 0, lines.length, res);
  console.log(res);
  for (var i = res.length - 1; i >= 0; i--) {
    if (res[i].type === "application/pdf") {
      const removed = lines.splice(res[i].start, res[i].end - res[i].start, "lolol");
      uploadBase64(removed.join(''), res[i].type, "hello");
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

function getMimeReplacements() {
  if (stage !== 1) {
    console.log("not signed in, can't do it");
    return;
  }
  gapi.client.drive.about.get({
    fields: "importFormats"
  }).then(
    response => {
      resp = response.result.importFormats;
      mimeReplacements = {};
      for (var key in resp) {
        if (Array.isArray(resp[key]) && resp[key].length === 1)
          mimeReplacements[key] = resp[key][0];
        else
          console.log("Strange import format: ", key, resp[key]);
      }
      if (stage === 1) stage = 2;
    },
    err => {
      console.error("err: ", err)
    }
  );
}

function uploadBase64(base64File, mimeType, filename) {
  const BOUNDARY = "--ASD_ASD_ASD_123456789_987654321_YUH_YUH";
  if (mimeType in mimeReplacements)
    mimeType = mimeReplacements[mimeType];

  gapi.client.request({
    path: "upload/drive/v3/files",
    method: "POST",
    params: { uploadType: "multipart" },
    headers: {
      "Content-type": `multipart/related; boundary=${BOUNDARY}`,
    },
    body: formatMultipartBody(filename, mimeType, base64File, BOUNDARY)
  }).then(
    response => console.log("upload success ", response),
    err => console.error("upload error ", err)
  );
}

function formatMultipartBody(fileName, fileType, base64Data, BOUNDARY) {
  // thank you to:
  // 1. https://stackoverflow.com/questions/51559203
  // 2. https://stackoverflow.com/questions/33842963
  const delimiter = "\r\n--" + BOUNDARY + "\r\n";
  const closeDelimiter = "\r\n--" + BOUNDARY + "--";
  const metadata = {
    name: fileName, mimeType: fileType || 'application/octet-stream'
  };
  const body =
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: ' + fileType + '\r\n' +
    'Content-Transfer-Encoding: base64\r\n' +
    '\r\n' +
    base64Data +
    closeDelimiter;
  return body;
}

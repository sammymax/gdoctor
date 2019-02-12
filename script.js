const CLIENT_ID = "823146793082-7lgsb7a22pdeilk7vbb8k9ptp7jnfgsm.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/drive.file";
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];

var stage = 0;
const signin_status = document.getElementById("signin-status");
const signin_button = document.getElementById("signin-button");
const file_input = document.getElementById("file-input");

var mimeReplacements = {};

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

function upload() {
  if (stage !== 2) {
    console.log("not ready");
    return;
  }
  upload_file(file_input.files[0]);
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

function upload_file(file) {
  console.log("uploading");
  console.log(file);
  const BOUNDARY = "--ASD_ASD_ASD_123456789_987654321_YUH_YUH";
  readFile(file).then(
    base64File => {
      var mimeType = file.type;
      if (mimeType in mimeReplacements)
        mimeType = mimeReplacements[mimeType];

      gapi.client.request({
        path: "upload/drive/v3/files",
        method: "POST",
        params: { uploadType: "multipart" },
        headers: {
          "Content-type": `multipart/related; boundary=${BOUNDARY}`,
        },
        body: formatMultipartBody("ayo2.png", mimeType, base64File, BOUNDARY)
      }).then(
        response => console.log("upload success ", response),
        err => console.error("upload error ", err)
      );
    }
  );
}

function readFile(file) {
  const fr = new FileReader();
  return new Promise((resolve, reject) => {
    fr.onload = (event) => resolve(btoa(fr.result));
    fr.readAsBinaryString(file);
  });
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

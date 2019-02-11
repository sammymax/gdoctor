const CLIENT_ID = "823146793082-7lgsb7a22pdeilk7vbb8k9ptp7jnfgsm.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/drive.file";
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];

var signin = false;
var signin_status = document.getElementById("signin-status");
var signin_button = document.getElementById("signin-button");
var file_input = document.getElementById("file-input");

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
  signin = isSignedIn;
  if (signin) {
    signin_status.innerHTML = "Signed in";
    signin_button.style.display = "none";
  } else {
    signin_status.innerHTML = "Not Signed In";
    signin_button.style.display = "inline-block";
  }
}

function signin(event) {
  gapi.auth2.getAuthInstance().signIn();
}

function upload() {
  if (!signin) {
    console.log("not signed in, can't do it");
    return;
  }
  upload_file(file_input.files[0]);
}

function upload_file(file) {
  console.log("uploading");
  console.log(file);
  const BOUNDARY = "--ASD_ASD_ASD_123456789_987654321_YUH_YUH";
  readFile(file).then(
    base64File => {
      console.log(base64File);
      gapi.client.request({
        path: "upload/drive/v3/files",
        method: "POST",
        params: { uploadType: "multipart" },
        headers: {
          "Content-type": `multipart/related; boundary=${BOUNDARY}`,
        },
        body: formatMultipartBody("ayo2.png", file.type, base64File, BOUNDARY)
      }).then(
        response => console.log("upload success ", response),
        err => console.error("upload error ", error)
      );
    }
  );
}

function readFile(file) {
  const fr = new FileReader();
  return new Promise((resolve, reject) => {
    fr.onload = (event) => resolve(btoa(fr.result));
    //fr.onload = (event) => resolve(fr.result);
    fr.readAsBinaryString(file);
  });
}

function formatMultipartBody(fileName, fileType, base64Data, BOUNDARY) {
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

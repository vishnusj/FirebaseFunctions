const functions = require("firebase-functions");
const { Storage } = require('@google-cloud/storage');
const os = require('os');
const path = require('path');
const spawn = require('child-process-promise').spawn;
const cors = require('cors')({ origin: true });
const Busboy = require('busboy');
const fs = require('fs');


// Your Google Cloud Platform project ID
const projectId = 'imageupload-9a880';


// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
exports.onFileChange = functions.storage.object().onFinalize(event => {

    const bucket = event.bucket;
    const contentType = event.contentType;
    const filePath = event.name;
    console.log('File change detected, function execution started');

    if (event.resourceState === 'not_exists') {
        console.log('We deleted a file, exit...');
        return;
    }

    if (path.basename(filePath).startsWith('resized-')) {
        console.log('We already resized that file!');
        return;
    }


    // Creates a client
    const storage = new Storage({
        projectId: "imageupload-9a880",
        keyFilename: "imageupload-9a880-firebase-adminsdk-mjzzb-3cd237ad59.json"
    });

    const destBucket = storage.bucket(bucket);
    const tmpFilePath = path.join(os.tmpdir(), path.basename(filePath));

    const metadata = { contentType: contentType };
    return destBucket.file(filePath).download({
        destination: tmpFilePath
    }).then(() => {
        return spawn('convert', [tmpFilePath, '-resize', '224x224', tmpFilePath]);
    }).then(() => {
        return destBucket.upload(tmpFilePath, {
            destination: 'resized-' + path.basename(filePath),
            metadata: metadata

        })

    });
});

exports.uploadFile = functions.https.onRequest((req, res) => {



    const gcs = new Storage({
        projectId: "imageupload-9a880",
        keyFilename: "imageupload-9a880-firebase-adminsdk-mjzzb-3cd237ad59.json"
    });




    // res.status(500).send({ test: 'Testing functions' });
    //Cross Origin Package
    cors(req, res, () => {
        // if (req.method !== "POST") {
        //     return res.status(500).json({
        //         message: "Not allowed"
        //     });
        // }
        const busboy = new Busboy({ headers: req.headers }); //
        let uploadData = null;

        busboy.on("file", (fieldname, file, filename, encoding, mimetype) => {
            //const filepath = path.join(os.tmpdir(), filename);
            const filepath = path.join(os.tmpdir(), filename);

            uploadData = { file: filepath, type: mimetype };
            file.pipe(fs.createWriteStream(filepath));
        });

        busboy.on("finish", () => {
            const bucket = gcs.bucket("imageupload-9a880.appspot.com");
            bucket
                .upload(uploadData.file, {
                    uploadType: "media",
                    metadata: {
                        metadata: {
                            contentType: uploadData.type
                        }
                    }
                })
                .then(() => {
                    return res.status(200).json({
                        message: "It worked!"
                    });
                })
                .catch(err => {
                    if (err) {
                        console.log(err.stack);
                    }
                    return res.status(500).json({
                        error: err
                    });
                });
        });
        busboy.end(req.rawBody);
    });
});
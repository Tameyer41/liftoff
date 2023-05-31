import { Configuration, OpenAIApi } from "openai";
import { IncomingForm } from "formidable";
const fs = require("fs");

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: any, res: any) {
  const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
  });
  const openai = new OpenAIApi(configuration);

  // Here, we create a temporary file to store the audio file using Vercel's tmp directory
  // As we compressed the file and are limiting recordings to 2.5 minutes, we won't run into trouble with storage capacity
  const fData = await new Promise<{ fields: any; files: any }>(
    (resolve, reject) => {
      const form = new IncomingForm({
        multiples: false,
        uploadDir: "/tmp",
        keepExtensions: true,
      });
      form.parse(req, (err, fields, files) => {
        if (err) return reject(err);
        resolve({ fields, files });
      });
    }
  );

  const videoFile = fData.files.file;
  const videoFilePath = videoFile?.filepath;
  console.log(videoFilePath);

  try {
    const resp = await openai.createTranscription(
      fs.createReadStream(videoFilePath),
      "whisper-1"
      // Uncomment the line below if you would also like to capture filler words:
      // "Please include any filler words such as 'um', 'uh', 'er', or other disfluencies in the transcription. Make sure to also capitalize and punctuate properly."
    );

    const transcript = resp?.data?.text;

    // Content moderation check
    const response = await openai.createModeration({
      input: resp?.data?.text,
    });

    if (response?.data?.results[0]?.flagged) {
      res
        .status(200)
        .json({ error: "Inappropriate content detected. Please try again." });
      return;
    }

    res.status(200).json({ transcript });
    return resp.data;
  } catch (error) {
    console.error("server error", error);
    res.status(500).json({ error: "Error" });
  }
}

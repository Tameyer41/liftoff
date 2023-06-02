import { AnimatePresence, motion } from "framer-motion";
import { RadioGroup } from "@headlessui/react";
import { v4 as uuid } from "uuid";
import Link from "next/link";
import { useRef, useState, useEffect, useCallback } from "react";
import Webcam from "react-webcam";
import { createFFmpeg, fetchFile } from "@ffmpeg/ffmpeg";

const questions = [
  {
    id: 1,
    name: "Behavioral",
    description: "From LinkedIn, Amazon, Adobe",
    difficulty: "Easy",
  },
  {
    id: 2,
    name: "Technical",
    description: "From Google, Meta, and Apple",
    difficulty: "Medium",
  },
];

const interviewers = [
  {
    id: "John",
    name: "John",
    description: "Software Engineering",
    level: "L3",
  },
  {
    id: "Richard",
    name: "Richard",
    description: "Product Management",
    level: "L5",
  },
  {
    id: "Sarah",
    name: "Sarah",
    description: "Other",
    level: "L7",
  },
];

const ffmpeg = createFFmpeg({
  // corePath: `http://localhost:3000/ffmpeg/dist/ffmpeg-core.js`,
  // I've included a default import above (and files in the public directory), but you can also use a CDN like this:
  corePath: "https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js",
  log: true,
});

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}

export default function DemoPage() {
  const [selected, setSelected] = useState(questions[0]);
  const [selectedInterviewer, setSelectedInterviewer] = useState(
    interviewers[0]
  );
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const webcamRef = useRef<Webcam | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [seconds, setSeconds] = useState(150);
  const [videoEnded, setVideoEnded] = useState(false);
  const [recordingPermission, setRecordingPermission] = useState(true);
  const [cameraLoaded, setCameraLoaded] = useState(false);
  const vidRef = useRef<HTMLVideoElement>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState("Processing");
  const [isSuccess, setIsSuccess] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [isDesktop, setIsDesktop] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [generatedFeedback, setGeneratedFeedback] = useState("");

  useEffect(() => {
    setIsDesktop(window.innerWidth >= 768);
  }, []);

  useEffect(() => {
    if (videoEnded) {
      const element = document.getElementById("startTimer");

      if (element) {
        element.style.display = "flex";
      }

      setCapturing(true);
      setIsVisible(false);

      mediaRecorderRef.current = new MediaRecorder(
        webcamRef?.current?.stream as MediaStream
      );
      mediaRecorderRef.current.addEventListener(
        "dataavailable",
        handleDataAvailable
      );
      mediaRecorderRef.current.start();
    }
  }, [videoEnded, webcamRef, setCapturing, mediaRecorderRef]);

  const handleStartCaptureClick = useCallback(() => {
    const startTimer = document.getElementById("startTimer");
    if (startTimer) {
      startTimer.style.display = "none";
    }

    if (vidRef.current) {
      vidRef.current.play();
    }
  }, [webcamRef, setCapturing, mediaRecorderRef]);

  const handleDataAvailable = useCallback(
    ({ data }: BlobEvent) => {
      if (data.size > 0) {
        setRecordedChunks((prev) => prev.concat(data));
      }
    },
    [setRecordedChunks]
  );

  const handleStopCaptureClick = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
    setCapturing(false);
  }, [mediaRecorderRef, webcamRef, setCapturing]);

  useEffect(() => {
    let timer: any = null;
    if (capturing) {
      timer = setInterval(() => {
        setSeconds((seconds) => seconds - 1);
      }, 1000);
      if (seconds === 0) {
        handleStopCaptureClick();
        setCapturing(false);
        setSeconds(0);
      }
    }
    return () => {
      clearInterval(timer);
    };
  });

  const handleDownload = async () => {
    if (recordedChunks.length) {
      setSubmitting(true);
      setStatus("Processing");

      const file = new Blob(recordedChunks, {
        type: `video/webm`,
      });

      const unique_id = uuid();

      // This checks if ffmpeg is loaded
      if (!ffmpeg.isLoaded()) {
        await ffmpeg.load();
      }

      // This writes the file to memory, removes the video, and converts the audio to mp3
      ffmpeg.FS("writeFile", `${unique_id}.webm`, await fetchFile(file));
      await ffmpeg.run(
        "-i",
        `${unique_id}.webm`,
        "-vn",
        "-acodec",
        "libmp3lame",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-f",
        "mp3",
        `${unique_id}.mp3`
      );

      // This reads the converted file from the file system
      const fileData = ffmpeg.FS("readFile", `${unique_id}.mp3`);
      // This creates a new file from the raw data
      const output = new File([fileData.buffer], `${unique_id}.mp3`, {
        type: "audio/mp3",
      });

      const formData = new FormData();
      formData.append("file", output, `${unique_id}.mp3`);
      formData.append("model", "whisper-1");

      const question =
        selected.name === "Behavioral"
          ? `Tell me about yourself. Why don${`’`}t you walk me through your resume?`
          : selectedInterviewer.name === "John"
          ? "What is a Hash Table, and what is the average case and worst case time for each of its operations?"
          : selectedInterviewer.name === "Richard"
          ? "Uber is looking to expand its product line. Talk me through how you would approach this problem."
          : "You have a 3-gallon jug and 5-gallon jug, how do you measure out exactly 4 gallons?";

      setStatus("Transcribing");

      const upload = await fetch(
        `/api/transcribe?question=${encodeURIComponent(question)}`,
        {
          method: "POST",
          body: formData,
        }
      );
      const results = await upload.json();

      if (upload.ok) {
        setIsSuccess(true);
        setSubmitting(false);

        if (results.error) {
          setTranscript(results.error);
        } else {
          setTranscript(results.transcript);
        }

        console.log("Uploaded successfully!");

        await Promise.allSettled([
          new Promise((resolve) => setTimeout(resolve, 800)),
        ]).then(() => {
          setCompleted(true);
          console.log("Success!");
        });

        if (results.transcript.length > 0) {
          const prompt = `Please give feedback on the following interview question: ${question} given the following transcript: ${
            results.transcript
          }. ${
            selected.name === "Behavioral"
              ? "Please also give feedback on the candidate's communication skills. Make sure their response is structured (perhaps using the STAR or PAR frameworks)."
              : "Please also give feedback on the candidate's communication skills. Make sure they accurately explain their thoughts in a coherent way. Make sure they stay on topic and relevant to the question."
          } \n\n\ Feedback on the candidate's response:`;

          setGeneratedFeedback("");
          const response = await fetch("/api/generate", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              prompt,
            }),
          });

          if (!response.ok) {
            throw new Error(response.statusText);
          }

          // This data is a ReadableStream
          const data = response.body;
          if (!data) {
            return;
          }

          const reader = data.getReader();
          const decoder = new TextDecoder();
          let done = false;

          while (!done) {
            const { value, done: doneReading } = await reader.read();
            done = doneReading;
            const chunkValue = decoder.decode(value);
            setGeneratedFeedback((prev: any) => prev + chunkValue);
          }
        }
      } else {
        console.error("Upload failed.");
      }

      setTimeout(function () {
        setRecordedChunks([]);
      }, 1500);
    }
  };

  function restartVideo() {
    setRecordedChunks([]);
    setVideoEnded(false);
    setCapturing(false);
    setIsVisible(true);
    setSeconds(150);
  }

  const videoConstraints = isDesktop
    ? { width: 1280, height: 720, facingMode: "user" }
    : { width: 480, height: 640, facingMode: "user" };

  const handleUserMedia = () => {
    setTimeout(() => {
      setLoading(false);
      setCameraLoaded(true);
    }, 1000);
  };

  return (
    <AnimatePresence>
      {step === 3 ? (
        <div className="w-full min-h-screen flex flex-col px-4 pt-2 pb-8 md:px-8 md:py-2 bg-[#FCFCFC] relative overflow-x-hidden">
          <p className="absolute w-full top-0 h-[60px] flex flex-row justify-between -ml-4 md:-ml-8">
            <span className="text-sm text-[#1a2b3b] font-medium">
              demo interview
            </span>
            <span className="text-sm text-[#1a2b3b] font-medium opacity-20">
              demo interview
            </span>
            <span className="text-sm text-[#1a2b3b] font-medium">
              demo interview
            </span>
            <span className="text-sm text-[#1a2b3b] font-medium opacity-20 hidden sm:block">
              demo interview
            </span>
            <span className="text-sm text-[#1a2b3b] font-medium hidden sm:block">
              demo interview
            </span>
            <span className="text-sm text-[#1a2b3b] font-medium opacity-20 hidden xl:block">
              demo interview
            </span>
            <span className="text-sm text-[#1a2b3b] font-medium opacity-20 hidden sm:block">
              demo interview
            </span>
            <span className="text-sm text-[#1a2b3b] font-medium opacity-20 hidden sm:block">
              demo interview
            </span>
            <span className="text-sm text-[#1a2b3b] font-medium hidden sm:block">
              demo interview
            </span>
            <span className="text-sm text-[#1a2b3b] font-medium opacity-20 hidden xl:block">
              demo interview
            </span>
          </p>
          {completed ? (
            <div className="w-full flex flex-col max-w-[1080px] mx-auto mt-[10vh] overflow-y-auto pb-8 md:pb-12">
              <motion.div
                initial={{ y: 20 }}
                animate={{ y: 0 }}
                transition={{ duration: 0.35, ease: [0.075, 0.82, 0.165, 1] }}
                className="relative md:aspect-[16/9] w-full max-w-[1080px] overflow-hidden bg-[#1D2B3A] rounded-lg ring-1 ring-gray-900/5 shadow-md flex flex-col items-center justify-center"
              >
                <video
                  className="w-full h-full rounded-lg"
                  controls
                  crossOrigin="anonymous"
                  autoPlay
                >
                  <source
                    src={URL.createObjectURL(
                      new Blob(recordedChunks, { type: "video/mp4" })
                    )}
                    type="video/mp4"
                  />
                </video>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: 0.5,
                  duration: 0.15,
                  ease: [0.23, 1, 0.82, 1],
                }}
                className="flex flex-col md:flex-row items-center mt-2 md:mt-4 md:justify-between space-y-1 md:space-y-0"
              >
                <div className="flex flex-row items-center space-x-1">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    className="w-4 h-4 text-[#407BBF] shrink-0"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                    />
                  </svg>
                  <p className="text-[14px] font-normal leading-[20px] text-[#1a2b3b]">
                    Video is not stored on our servers, and will go away as soon
                    as you leave the page.
                  </p>
                </div>
                <Link
                  href="https://github.com/Tameyer41/liftoff"
                  target="_blank"
                  className="group rounded-full pl-[8px] min-w-[180px] pr-4 py-2 text-[13px] font-semibold transition-all flex items-center justify-center bg-[#1E2B3A] text-white hover:[linear-gradient(0deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.1)), #0D2247] no-underline flex gap-x-2  active:scale-95 scale-100 duration-75"
                  style={{
                    boxShadow:
                      "0px 1px 4px rgba(13, 34, 71, 0.17), inset 0px 0px 0px 1px #061530, inset 0px 0px 0px 2px rgba(255, 255, 255, 0.1)",
                  }}
                >
                  <span className="w-5 h-5 rounded-full bg-[#407BBF] flex items-center justify-center">
                    <svg
                      className="w-[16px] h-[16px] text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M4.75 7.75C4.75 6.64543 5.64543 5.75 6.75 5.75H17.25C18.3546 5.75 19.25 6.64543 19.25 7.75V16.25C19.25 17.3546 18.3546 18.25 17.25 18.25H6.75C5.64543 18.25 4.75 17.3546 4.75 16.25V7.75Z"
                      ></path>
                      <path
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M5.5 6.5L12 12.25L18.5 6.5"
                      ></path>
                    </svg>
                  </span>
                  Star on Github
                </Link>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: 0.5,
                  duration: 0.15,
                  ease: [0.23, 1, 0.82, 1],
                }}
                className="mt-8 flex flex-col"
              >
                <div>
                  <h2 className="text-xl font-semibold text-left text-[#1D2B3A] mb-2">
                    Transcript
                  </h2>
                  <p className="prose prose-sm max-w-none">
                    {transcript.length > 0
                      ? transcript
                      : "Don't think you said anything. Want to try again?"}
                  </p>
                </div>
                <div className="mt-8">
                  <h2 className="text-xl font-semibold text-left text-[#1D2B3A] mb-2">
                    Feedback
                  </h2>
                  <div className="mt-4 text-sm flex gap-2.5 rounded-lg border border-[#EEEEEE] bg-[#FAFAFA] p-4 leading-6 text-gray-900 min-h-[100px]">
                    <p className="prose prose-sm max-w-none">
                      {generatedFeedback}
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>
          ) : (
            <div className="h-full w-full items-center flex flex-col mt-[10vh]">
              {recordingPermission ? (
                <div className="w-full flex flex-col max-w-[1080px] mx-auto justify-center">
                  <h2 className="text-2xl font-semibold text-left text-[#1D2B3A] mb-2">
                    {selected.name === "Behavioral"
                      ? `Tell me about yourself. Why don${`’`}t you walk me through your resume?`
                      : selectedInterviewer.name === "John"
                      ? "What is a Hash Table, and what is the average case and worst case time for each of its operations?"
                      : selectedInterviewer.name === "Richard"
                      ? "Uber is looking to expand its product line. Talk me through how you would approach this problem."
                      : "You have a 3-gallon jug and 5-gallon jug, how do you measure out exactly 4 gallons?"}
                  </h2>
                  <span className="text-[14px] leading-[20px] text-[#1a2b3b] font-normal mb-4">
                    Asked by top companies like Google, Facebook and more
                  </span>
                  <motion.div
                    initial={{ y: -20 }}
                    animate={{ y: 0 }}
                    transition={{
                      duration: 0.35,
                      ease: [0.075, 0.82, 0.965, 1],
                    }}
                    className="relative aspect-[16/9] w-full max-w-[1080px] overflow-hidden bg-[#1D2B3A] rounded-lg ring-1 ring-gray-900/5 shadow-md"
                  >
                    {!cameraLoaded && (
                      <div className="text-white absolute top-1/2 left-1/2 z-20 flex items-center">
                        <svg
                          className="animate-spin h-4 w-4 text-white mx-auto my-0.5"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth={3}
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                      </div>
                    )}
                    <div className="relative z-10 h-full w-full rounded-lg">
                      <div className="absolute top-5 lg:top-10 left-5 lg:left-10 z-20">
                        <span className="inline-flex items-center rounded-md bg-gray-100 px-2.5 py-0.5 text-sm font-medium text-gray-800">
                          {new Date(seconds * 1000).toISOString().slice(14, 19)}
                        </span>
                      </div>
                      {isVisible && ( // If the video is visible (on screen) we show it
                        <div className="block absolute top-[10px] sm:top-[20px] lg:top-[40px] left-auto right-[10px] sm:right-[20px] md:right-10 h-[80px] sm:h-[140px] md:h-[180px] aspect-video rounded z-20">
                          <div className="h-full w-full aspect-video rounded md:rounded-lg lg:rounded-xl">
                            <video
                              id="question-video"
                              onEnded={() => setVideoEnded(true)}
                              controls={false}
                              ref={vidRef}
                              playsInline
                              className="h-full object-cover w-full rounded-md md:rounded-[12px] aspect-video"
                              crossOrigin="anonymous"
                            >
                              <source
                                src={
                                  selectedInterviewer.name === "John"
                                    ? selected.name === "Behavioral"
                                      ? "https://liftoff-public.s3.amazonaws.com/DemoInterviewMale.mp4"
                                      : "https://liftoff-public.s3.amazonaws.com/JohnTechnical.mp4"
                                    : selectedInterviewer.name === "Richard"
                                    ? selected.name === "Behavioral"
                                      ? "https://liftoff-public.s3.amazonaws.com/RichardBehavioral.mp4"
                                      : "https://liftoff-public.s3.amazonaws.com/RichardTechnical.mp4"
                                    : selectedInterviewer.name === "Sarah"
                                    ? selected.name === "Behavioral"
                                      ? "https://liftoff-public.s3.amazonaws.com/BehavioralSarah.mp4"
                                      : "https://liftoff-public.s3.amazonaws.com/SarahTechnical.mp4"
                                    : selected.name === "Behavioral"
                                    ? "https://liftoff-public.s3.amazonaws.com/DemoInterviewMale.mp4"
                                    : "https://liftoff-public.s3.amazonaws.com/JohnTechnical.mp4"
                                }
                                type="video/mp4"
                              />
                            </video>
                          </div>
                        </div>
                      )}
                      <Webcam
                        mirrored
                        audio
                        muted
                        ref={webcamRef}
                        videoConstraints={videoConstraints}
                        onUserMedia={handleUserMedia}
                        onUserMediaError={(error) => {
                          setRecordingPermission(false);
                        }}
                        className="absolute z-10 min-h-[100%] min-w-[100%] h-auto w-auto object-cover"
                      />
                    </div>
                    {loading && (
                      <div className="absolute flex h-full w-full items-center justify-center">
                        <div className="relative h-[112px] w-[112px] rounded-lg object-cover text-[2rem]">
                          <div className="flex h-[112px] w-[112px] items-center justify-center rounded-[0.5rem] bg-[#4171d8] !text-white">
                            Loading...
                          </div>
                        </div>
                      </div>
                    )}

                    {cameraLoaded && (
                      <div className="absolute bottom-0 left-0 z-50 flex h-[82px] w-full items-center justify-center">
                        {recordedChunks.length > 0 ? (
                          <>
                            {isSuccess ? (
                              <button
                                className="cursor-disabled group rounded-full min-w-[140px] px-4 py-2 text-[13px] font-semibold group inline-flex items-center justify-center text-sm text-white duration-150 bg-green-500 hover:bg-green-600 hover:text-slate-100 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 active:scale-100 active:bg-green-800 active:text-green-100"
                                style={{
                                  boxShadow:
                                    "0px 1px 4px rgba(27, 71, 13, 0.17), inset 0px 0px 0px 1px #5fc767, inset 0px 0px 0px 2px rgba(255, 255, 255, 0.1)",
                                }}
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-5 w-5 mx-auto"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={2}
                                >
                                  <motion.path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                    initial={{ pathLength: 0 }}
                                    animate={{ pathLength: 1 }}
                                    transition={{ duration: 0.5 }}
                                  />
                                </svg>
                              </button>
                            ) : (
                              <div className="flex flex-row gap-2">
                                {!isSubmitting && (
                                  <button
                                    onClick={() => restartVideo()}
                                    className="group rounded-full px-4 py-2 text-[13px] font-semibold transition-all flex items-center justify-center bg-white text-[#1E2B3A] hover:[linear-gradient(0deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.1)), #0D2247] no-underline flex gap-x-2  active:scale-95 scale-100 duration-75"
                                  >
                                    Restart
                                  </button>
                                )}
                                <button
                                  onClick={handleDownload}
                                  disabled={isSubmitting}
                                  className="group rounded-full min-w-[140px] px-4 py-2 text-[13px] font-semibold transition-all flex items-center justify-center bg-[#1E2B3A] text-white hover:[linear-gradient(0deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.1)), #0D2247] no-underline flex  active:scale-95 scale-100 duration-75  disabled:cursor-not-allowed"
                                  style={{
                                    boxShadow:
                                      "0px 1px 4px rgba(13, 34, 71, 0.17), inset 0px 0px 0px 1px #061530, inset 0px 0px 0px 2px rgba(255, 255, 255, 0.1)",
                                  }}
                                >
                                  <span>
                                    {isSubmitting ? (
                                      <div className="flex items-center justify-center gap-x-2">
                                        <svg
                                          className="animate-spin h-5 w-5 text-slate-50 mx-auto"
                                          xmlns="http://www.w3.org/2000/svg"
                                          fill="none"
                                          viewBox="0 0 24 24"
                                        >
                                          <circle
                                            className="opacity-25"
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke="currentColor"
                                            strokeWidth={3}
                                          ></circle>
                                          <path
                                            className="opacity-75"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                          ></path>
                                        </svg>
                                        <span>{status}</span>
                                      </div>
                                    ) : (
                                      <div className="flex items-center justify-center gap-x-2">
                                        <span>Process transcript</span>
                                        <svg
                                          className="w-5 h-5"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          xmlns="http://www.w3.org/2000/svg"
                                        >
                                          <path
                                            d="M13.75 6.75L19.25 12L13.75 17.25"
                                            stroke="white"
                                            strokeWidth="1.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          />
                                          <path
                                            d="M19 12H4.75"
                                            stroke="white"
                                            strokeWidth="1.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          />
                                        </svg>
                                      </div>
                                    )}
                                  </span>
                                </button>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="absolute bottom-[6px] md:bottom-5 left-5 right-5">
                            <div className="lg:mt-4 flex flex-col items-center justify-center gap-2">
                              {capturing ? (
                                <div
                                  id="stopTimer"
                                  onClick={handleStopCaptureClick}
                                  className="flex h-10 w-10 flex-col items-center justify-center rounded-full bg-transparent text-white hover:shadow-xl ring-4 ring-white  active:scale-95 scale-100 duration-75 cursor-pointer"
                                >
                                  <div className="h-5 w-5 rounded bg-red-500 cursor-pointer"></div>
                                </div>
                              ) : (
                                <button
                                  id="startTimer"
                                  onClick={handleStartCaptureClick}
                                  className="flex h-8 w-8 sm:h-8 sm:w-8 flex-col items-center justify-center rounded-full bg-red-500 text-white hover:shadow-xl ring-4 ring-white ring-offset-gray-500 ring-offset-2 active:scale-95 scale-100 duration-75"
                                ></button>
                              )}
                              <div className="w-12"></div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    <div
                      className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 text-5xl text-white font-semibold text-center"
                      id="countdown"
                    ></div>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      delay: 0.5,
                      duration: 0.15,
                      ease: [0.23, 1, 0.82, 1],
                    }}
                    className="flex flex-row space-x-1 mt-4 items-center"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                      className="w-4 h-4 text-[#407BBF]"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                      />
                    </svg>
                    <p className="text-[14px] font-normal leading-[20px] text-[#1a2b3b]">
                      Video is not stored on our servers, it is solely used for
                      transcription.
                    </p>
                  </motion.div>
                </div>
              ) : (
                <div className="w-full flex flex-col max-w-[1080px] mx-auto justify-center">
                  <motion.div
                    initial={{ y: 20 }}
                    animate={{ y: 0 }}
                    transition={{
                      duration: 0.35,
                      ease: [0.075, 0.82, 0.165, 1],
                    }}
                    className="relative md:aspect-[16/9] w-full max-w-[1080px] overflow-hidden bg-[#1D2B3A] rounded-lg ring-1 ring-gray-900/5 shadow-md flex flex-col items-center justify-center"
                  >
                    <p className="text-white font-medium text-lg text-center max-w-3xl">
                      Camera permission is denied. We don{`'`}t store your
                      attempts anywhere, but we understand not wanting to give
                      us access to your camera. Try again by opening this page
                      in an incognito window {`(`}or enable permissions in your
                      browser settings{`)`}.
                    </p>
                  </motion.div>
                  <div className="flex flex-row space-x-4 mt-8 justify-end">
                    <button
                      onClick={() => setStep(1)}
                      className="group max-w-[200px] rounded-full px-4 py-2 text-[13px] font-semibold transition-all flex items-center justify-center bg-[#f5f7f9] text-[#1E2B3A] no-underline active:scale-95 scale-100 duration-75"
                      style={{
                        boxShadow: "0 1px 1px #0c192714, 0 1px 3px #0c192724",
                      }}
                    >
                      Restart demo
                    </button>
                    <Link
                      href="https://github.com/Tameyer41/liftoff"
                      target="_blank"
                      className="group rounded-full pl-[8px] min-w-[180px] pr-4 py-2 text-[13px] font-semibold transition-all flex items-center justify-center bg-[#1E2B3A] text-white hover:[linear-gradient(0deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.1)), #0D2247] no-underline flex gap-x-2  active:scale-95 scale-100 duration-75"
                      style={{
                        boxShadow:
                          "0px 1px 4px rgba(13, 34, 71, 0.17), inset 0px 0px 0px 1px #061530, inset 0px 0px 0px 2px rgba(255, 255, 255, 0.1)",
                      }}
                    >
                      <span className="w-5 h-5 rounded-full bg-[#407BBF] flex items-center justify-center">
                        <svg
                          className="w-[16px] h-[16px] text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M4.75 7.75C4.75 6.64543 5.64543 5.75 6.75 5.75H17.25C18.3546 5.75 19.25 6.64543 19.25 7.75V16.25C19.25 17.3546 18.3546 18.25 17.25 18.25H6.75C5.64543 18.25 4.75 17.3546 4.75 16.25V7.75Z"
                          ></path>
                          <path
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M5.5 6.5L12 12.25L18.5 6.5"
                          ></path>
                        </svg>
                      </span>
                      Star on Github
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col md:flex-row w-full md:overflow-hidden">
          <motion.p
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 1.25, ease: [0.23, 1, 0.32, 1] }}
            className="absolute w-full md:w-1/2 top-0 h-[60px] flex flex-row justify-between"
          >
            <span className="text-sm text-[#1a2b3b] font-medium">
              demo interview
            </span>
            <span className="text-sm text-[#1a2b3b] font-medium opacity-20">
              demo interview
            </span>
            <span className="text-sm text-[#1a2b3b] font-medium">
              demo interview
            </span>
            <span className="text-sm text-[#1a2b3b] font-medium opacity-20 hidden sm:block">
              demo interview
            </span>
            <span className="text-sm text-[#1a2b3b] font-medium hidden sm:block">
              demo interview
            </span>
            <span className="text-sm text-[#1a2b3b] font-medium opacity-20 hidden xl:block">
              demo interview
            </span>
          </motion.p>
          <div className="w-full min-h-[60vh] md:w-1/2 md:h-screen flex flex-col px-4 pt-2 pb-8 md:px-0 md:py-2 bg-[#FCFCFC] justify-center">
            <div className="h-full w-full items-center justify-center flex flex-col">
              {step === 1 ? (
                <motion.div
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -40 }}
                  key="step-1"
                  transition={{
                    duration: 0.95,
                    ease: [0.165, 0.84, 0.44, 1],
                  }}
                  className="max-w-lg mx-auto px-4 lg:px-0"
                >
                  <h2 className="text-4xl font-bold text-[#1E2B3A]">
                    Select a question type
                  </h2>
                  <p className="text-[14px] leading-[20px] text-[#1a2b3b] font-normal my-4">
                    We have hundreds of questions from top tech companies.
                    Choose a type to get started.
                  </p>
                  <div>
                    <RadioGroup value={selected} onChange={setSelected}>
                      <RadioGroup.Label className="sr-only">
                        Server size
                      </RadioGroup.Label>
                      <div className="space-y-4">
                        {questions.map((question) => (
                          <RadioGroup.Option
                            key={question.name}
                            value={question}
                            className={({ checked, active }) =>
                              classNames(
                                checked
                                  ? "border-transparent"
                                  : "border-gray-300",
                                active
                                  ? "border-blue-500 ring-2 ring-blue-200"
                                  : "",
                                "relative cursor-pointer rounded-lg border bg-white px-6 py-4 shadow-sm focus:outline-none flex justify-between"
                              )
                            }
                          >
                            {({ active, checked }) => (
                              <>
                                <span className="flex items-center">
                                  <span className="flex flex-col text-sm">
                                    <RadioGroup.Label
                                      as="span"
                                      className="font-medium text-gray-900"
                                    >
                                      {question.name}
                                    </RadioGroup.Label>
                                    <RadioGroup.Description
                                      as="span"
                                      className="text-gray-500"
                                    >
                                      <span className="block">
                                        {question.description}
                                      </span>
                                    </RadioGroup.Description>
                                  </span>
                                </span>
                                <RadioGroup.Description
                                  as="span"
                                  className="flex text-sm ml-4 mt-0 flex-col text-right items-center justify-center"
                                >
                                  <span className=" text-gray-500">
                                    {question.difficulty === "Easy" ? (
                                      <svg
                                        className="h-full w-[16px]"
                                        viewBox="0 0 22 25"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                      >
                                        <rect
                                          y="13.1309"
                                          width="6"
                                          height="11"
                                          rx="1"
                                          fill="#4E7BBA"
                                        />
                                        <rect
                                          x="8"
                                          y="8.13086"
                                          width="6"
                                          height="16"
                                          rx="1"
                                          fill="#E1E1E1"
                                        />
                                        <rect
                                          x="16"
                                          y="0.130859"
                                          width="6"
                                          height="24"
                                          rx="1"
                                          fill="#E1E1E1"
                                        />
                                      </svg>
                                    ) : (
                                      <svg
                                        className="h-full w-[16px]"
                                        viewBox="0 0 22 25"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                      >
                                        <rect
                                          y="13.1309"
                                          width="6"
                                          height="11"
                                          rx="1"
                                          fill="#4E7BBA"
                                        />
                                        <rect
                                          x="8"
                                          y="8.13086"
                                          width="6"
                                          height="16"
                                          rx="1"
                                          fill="#4E7BBA"
                                        />
                                        <rect
                                          x="16"
                                          y="0.130859"
                                          width="6"
                                          height="24"
                                          rx="1"
                                          fill="#E1E1E1"
                                        />
                                      </svg>
                                    )}
                                  </span>
                                  <span className="font-medium text-gray-900">
                                    {question.difficulty}
                                  </span>
                                </RadioGroup.Description>
                                <span
                                  className={classNames(
                                    active ? "border" : "border-2",
                                    checked
                                      ? "border-blue-500"
                                      : "border-transparent",
                                    "pointer-events-none absolute -inset-px rounded-lg"
                                  )}
                                  aria-hidden="true"
                                />
                              </>
                            )}
                          </RadioGroup.Option>
                        ))}
                      </div>
                    </RadioGroup>
                  </div>
                  <div className="flex gap-[15px] justify-end mt-8">
                    <div>
                      <Link
                        href="/"
                        className="group rounded-full px-4 py-2 text-[13px] font-semibold transition-all flex items-center justify-center bg-[#f5f7f9] text-[#1E2B3A] no-underline active:scale-95 scale-100 duration-75"
                        style={{
                          boxShadow: "0 1px 1px #0c192714, 0 1px 3px #0c192724",
                        }}
                      >
                        Back to home
                      </Link>
                    </div>
                    <div>
                      <button
                        onClick={() => {
                          setStep(2);
                        }}
                        className="group rounded-full px-4 py-2 text-[13px] font-semibold transition-all flex items-center justify-center bg-[#1E2B3A] text-white hover:[linear-gradient(0deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.1)), #0D2247] no-underline flex gap-x-2  active:scale-95 scale-100 duration-75"
                        style={{
                          boxShadow:
                            "0px 1px 4px rgba(13, 34, 71, 0.17), inset 0px 0px 0px 1px #061530, inset 0px 0px 0px 2px rgba(255, 255, 255, 0.1)",
                        }}
                      >
                        <span> Continue </span>
                        <svg
                          className="w-5 h-5"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M13.75 6.75L19.25 12L13.75 17.25"
                            stroke="#FFF"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M19 12H4.75"
                            stroke="#FFF"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                </motion.div>
              ) : step === 2 ? (
                <motion.div
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -40 }}
                  key="step-2"
                  transition={{
                    duration: 0.95,
                    ease: [0.165, 0.84, 0.44, 1],
                  }}
                  className="max-w-lg mx-auto px-4 lg:px-0"
                >
                  <h2 className="text-4xl font-bold text-[#1E2B3A]">
                    And an interviewer
                  </h2>
                  <p className="text-[14px] leading-[20px] text-[#1a2b3b] font-normal my-4">
                    Choose whoever makes you feel comfortable. You can always
                    try again with another one.
                  </p>
                  <div>
                    <RadioGroup
                      value={selectedInterviewer}
                      onChange={setSelectedInterviewer}
                    >
                      <RadioGroup.Label className="sr-only">
                        Server size
                      </RadioGroup.Label>
                      <div className="space-y-4">
                        {interviewers.map((interviewer) => (
                          <RadioGroup.Option
                            key={interviewer.name}
                            value={interviewer}
                            className={({ checked, active }) =>
                              classNames(
                                checked
                                  ? "border-transparent"
                                  : "border-gray-300",
                                active
                                  ? "border-blue-500 ring-2 ring-blue-200"
                                  : "",
                                "relative cursor-pointer rounded-lg border bg-white px-6 py-4 shadow-sm focus:outline-none flex justify-between"
                              )
                            }
                          >
                            {({ active, checked }) => (
                              <>
                                <span className="flex items-center">
                                  <span className="flex flex-col text-sm">
                                    <RadioGroup.Label
                                      as="span"
                                      className="font-medium text-gray-900"
                                    >
                                      {interviewer.name}
                                    </RadioGroup.Label>
                                    <RadioGroup.Description
                                      as="span"
                                      className="text-gray-500"
                                    >
                                      <span className="block">
                                        {interviewer.description}
                                      </span>
                                    </RadioGroup.Description>
                                  </span>
                                </span>
                                <RadioGroup.Description
                                  as="span"
                                  className="flex text-sm ml-4 mt-0 flex-col text-right items-center justify-center"
                                >
                                  <span className=" text-gray-500">
                                    <svg
                                      className="w-[28px] h-full"
                                      viewBox="0 0 38 30"
                                      fill="none"
                                      xmlns="http://www.w3.org/2000/svg"
                                    >
                                      <g filter="url(#filter0_d_34_25)">
                                        <g clipPath="url(#clip0_34_25)">
                                          <mask
                                            id="mask0_34_25"
                                            style={{ maskType: "luminance" }}
                                            maskUnits="userSpaceOnUse"
                                            x="3"
                                            y="1"
                                            width="32"
                                            height="24"
                                          >
                                            <rect
                                              x="3"
                                              y="1"
                                              width="32"
                                              height="24"
                                              fill="white"
                                            />
                                          </mask>
                                          <g mask="url(#mask0_34_25)">
                                            <path
                                              fillRule="evenodd"
                                              clipRule="evenodd"
                                              d="M3 1H35V25H3V1Z"
                                              fill="#F7FCFF"
                                            />
                                            <path
                                              fillRule="evenodd"
                                              clipRule="evenodd"
                                              d="M3 15.6666V17.6666H35V15.6666H3Z"
                                              fill="#E31D1C"
                                            />
                                            <path
                                              fillRule="evenodd"
                                              clipRule="evenodd"
                                              d="M3 19.3334V21.3334H35V19.3334H3Z"
                                              fill="#E31D1C"
                                            />
                                            <path
                                              fillRule="evenodd"
                                              clipRule="evenodd"
                                              d="M3 8.33337V10.3334H35V8.33337H3Z"
                                              fill="#E31D1C"
                                            />
                                            <path
                                              fillRule="evenodd"
                                              clipRule="evenodd"
                                              d="M3 23V25H35V23H3Z"
                                              fill="#E31D1C"
                                            />
                                            <path
                                              fillRule="evenodd"
                                              clipRule="evenodd"
                                              d="M3 12V14H35V12H3Z"
                                              fill="#E31D1C"
                                            />
                                            <path
                                              fillRule="evenodd"
                                              clipRule="evenodd"
                                              d="M3 1V3H35V1H3Z"
                                              fill="#E31D1C"
                                            />
                                            <path
                                              fillRule="evenodd"
                                              clipRule="evenodd"
                                              d="M3 4.66663V6.66663H35V4.66663H3Z"
                                              fill="#E31D1C"
                                            />
                                            <rect
                                              x="3"
                                              y="1"
                                              width="20"
                                              height="13"
                                              fill="#2E42A5"
                                            />
                                            <path
                                              fillRule="evenodd"
                                              clipRule="evenodd"
                                              d="M4.72221 3.93871L3.99633 4.44759L4.2414 3.54198L3.59668 2.96807H4.43877L4.7212 2.229L5.05237 2.96807H5.77022L5.20619 3.54198L5.42455 4.44759L4.72221 3.93871ZM8.72221 3.93871L7.99633 4.44759L8.2414 3.54198L7.59668 2.96807H8.43877L8.7212 2.229L9.05237 2.96807H9.77022L9.20619 3.54198L9.42455 4.44759L8.72221 3.93871ZM11.9963 4.44759L12.7222 3.93871L13.4245 4.44759L13.2062 3.54198L13.7702 2.96807H13.0524L12.7212 2.229L12.4388 2.96807H11.5967L12.2414 3.54198L11.9963 4.44759ZM16.7222 3.93871L15.9963 4.44759L16.2414 3.54198L15.5967 2.96807H16.4388L16.7212 2.229L17.0524 2.96807H17.7702L17.2062 3.54198L17.4245 4.44759L16.7222 3.93871ZM3.99633 8.44759L4.72221 7.93871L5.42455 8.44759L5.20619 7.54198L5.77022 6.96807H5.05237L4.7212 6.229L4.43877 6.96807H3.59668L4.2414 7.54198L3.99633 8.44759ZM8.72221 7.93871L7.99633 8.44759L8.2414 7.54198L7.59668 6.96807H8.43877L8.7212 6.229L9.05237 6.96807H9.77022L9.20619 7.54198L9.42455 8.44759L8.72221 7.93871ZM11.9963 8.44759L12.7222 7.93871L13.4245 8.44759L13.2062 7.54198L13.7702 6.96807H13.0524L12.7212 6.229L12.4388 6.96807H11.5967L12.2414 7.54198L11.9963 8.44759ZM16.7222 7.93871L15.9963 8.44759L16.2414 7.54198L15.5967 6.96807H16.4388L16.7212 6.229L17.0524 6.96807H17.7702L17.2062 7.54198L17.4245 8.44759L16.7222 7.93871ZM3.99633 12.4476L4.72221 11.9387L5.42455 12.4476L5.20619 11.542L5.77022 10.9681H5.05237L4.7212 10.229L4.43877 10.9681H3.59668L4.2414 11.542L3.99633 12.4476ZM8.72221 11.9387L7.99633 12.4476L8.2414 11.542L7.59668 10.9681H8.43877L8.7212 10.229L9.05237 10.9681H9.77022L9.20619 11.542L9.42455 12.4476L8.72221 11.9387ZM11.9963 12.4476L12.7222 11.9387L13.4245 12.4476L13.2062 11.542L13.7702 10.9681H13.0524L12.7212 10.229L12.4388 10.9681H11.5967L12.2414 11.542L11.9963 12.4476ZM16.7222 11.9387L15.9963 12.4476L16.2414 11.542L15.5967 10.9681H16.4388L16.7212 10.229L17.0524 10.9681H17.7702L17.2062 11.542L17.4245 12.4476L16.7222 11.9387ZM19.9963 4.44759L20.7222 3.93871L21.4245 4.44759L21.2062 3.54198L21.7702 2.96807H21.0524L20.7212 2.229L20.4388 2.96807H19.5967L20.2414 3.54198L19.9963 4.44759ZM20.7222 7.93871L19.9963 8.44759L20.2414 7.54198L19.5967 6.96807H20.4388L20.7212 6.229L21.0524 6.96807H21.7702L21.2062 7.54198L21.4245 8.44759L20.7222 7.93871ZM19.9963 12.4476L20.7222 11.9387L21.4245 12.4476L21.2062 11.542L21.7702 10.9681H21.0524L20.7212 10.229L20.4388 10.9681H19.5967L20.2414 11.542L19.9963 12.4476ZM6.72221 5.93871L5.99633 6.44759L6.2414 5.54198L5.59668 4.96807H6.43877L6.7212 4.229L7.05237 4.96807H7.77022L7.20619 5.54198L7.42455 6.44759L6.72221 5.93871ZM9.99633 6.44759L10.7222 5.93871L11.4245 6.44759L11.2062 5.54198L11.7702 4.96807H11.0524L10.7212 4.229L10.4388 4.96807H9.59668L10.2414 5.54198L9.99633 6.44759ZM14.7222 5.93871L13.9963 6.44759L14.2414 5.54198L13.5967 4.96807H14.4388L14.7212 4.229L15.0524 4.96807H15.7702L15.2062 5.54198L15.4245 6.44759L14.7222 5.93871ZM5.99633 10.4476L6.72221 9.93871L7.42455 10.4476L7.20619 9.54198L7.77022 8.96807H7.05237L6.7212 8.229L6.43877 8.96807H5.59668L6.2414 9.54198L5.99633 10.4476ZM10.7222 9.93871L9.99633 10.4476L10.2414 9.54198L9.59668 8.96807H10.4388L10.7212 8.229L11.0524 8.96807H11.7702L11.2062 9.54198L11.4245 10.4476L10.7222 9.93871ZM13.9963 10.4476L14.7222 9.93871L15.4245 10.4476L15.2062 9.54198L15.7702 8.96807H15.0524L14.7212 8.229L14.4388 8.96807H13.5967L14.2414 9.54198L13.9963 10.4476ZM18.7222 5.93871L17.9963 6.44759L18.2414 5.54198L17.5967 4.96807H18.4388L18.7212 4.229L19.0524 4.96807H19.7702L19.2062 5.54198L19.4245 6.44759L18.7222 5.93871ZM17.9963 10.4476L18.7222 9.93871L19.4245 10.4476L19.2062 9.54198L19.7702 8.96807H19.0524L18.7212 8.229L18.4388 8.96807H17.5967L18.2414 9.54198L17.9963 10.4476Z"
                                              fill="#F7FCFF"
                                            />
                                          </g>
                                          <rect
                                            x="3"
                                            y="1"
                                            width="32"
                                            height="24"
                                            fill="url(#paint0_linear_34_25)"
                                            style={{ mixBlendMode: "overlay" }}
                                          />
                                        </g>
                                        <rect
                                          x="3.5"
                                          y="1.5"
                                          width="31"
                                          height="23"
                                          rx="1.5"
                                          stroke="black"
                                          strokeOpacity="0.1"
                                          style={{ mixBlendMode: "multiply" }}
                                        />
                                      </g>
                                      <defs>
                                        <filter
                                          id="filter0_d_34_25"
                                          x="0"
                                          y="0"
                                          width="38"
                                          height="30"
                                          filterUnits="userSpaceOnUse"
                                          colorInterpolationFilters="sRGB"
                                        >
                                          <feFlood
                                            floodOpacity="0"
                                            result="BackgroundImageFix"
                                          />
                                          <feColorMatrix
                                            in="SourceAlpha"
                                            type="matrix"
                                            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                                            result="hardAlpha"
                                          />
                                          <feOffset dy="2" />
                                          <feGaussianBlur stdDeviation="1.5" />
                                          <feColorMatrix
                                            type="matrix"
                                            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.1 0"
                                          />
                                          <feBlend
                                            mode="normal"
                                            in2="BackgroundImageFix"
                                            result="effect1_dropShadow_34_25"
                                          />
                                          <feBlend
                                            mode="normal"
                                            in="SourceGraphic"
                                            in2="effect1_dropShadow_34_25"
                                            result="shape"
                                          />
                                        </filter>
                                        <linearGradient
                                          id="paint0_linear_34_25"
                                          x1="19"
                                          y1="1"
                                          x2="19"
                                          y2="25"
                                          gradientUnits="userSpaceOnUse"
                                        >
                                          <stop
                                            stopColor="white"
                                            stopOpacity="0.7"
                                          />
                                          <stop offset="1" stopOpacity="0.3" />
                                        </linearGradient>
                                        <clipPath id="clip0_34_25">
                                          <rect
                                            x="3"
                                            y="1"
                                            width="32"
                                            height="24"
                                            rx="2"
                                            fill="white"
                                          />
                                        </clipPath>
                                      </defs>
                                    </svg>
                                  </span>
                                  <span className="font-medium text-gray-900">
                                    EN
                                  </span>
                                </RadioGroup.Description>
                                <span
                                  className={classNames(
                                    active ? "border" : "border-2",
                                    checked
                                      ? "border-blue-500"
                                      : "border-transparent",
                                    "pointer-events-none absolute -inset-px rounded-lg"
                                  )}
                                  aria-hidden="true"
                                />
                              </>
                            )}
                          </RadioGroup.Option>
                        ))}
                      </div>
                    </RadioGroup>
                  </div>
                  <div className="flex gap-[15px] justify-end mt-8">
                    <div>
                      <button
                        onClick={() => setStep(1)}
                        className="group rounded-full px-4 py-2 text-[13px] font-semibold transition-all flex items-center justify-center bg-[#f5f7f9] text-[#1E2B3A] no-underline active:scale-95 scale-100 duration-75"
                        style={{
                          boxShadow: "0 1px 1px #0c192714, 0 1px 3px #0c192724",
                        }}
                      >
                        Previous step
                      </button>
                    </div>
                    <div>
                      <button
                        onClick={() => {
                          setStep(3);
                        }}
                        className="group rounded-full px-4 py-2 text-[13px] font-semibold transition-all flex items-center justify-center bg-[#1E2B3A] text-white hover:[linear-gradient(0deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.1)), #0D2247] no-underline flex gap-x-2  active:scale-95 scale-100 duration-75"
                        style={{
                          boxShadow:
                            "0px 1px 4px rgba(13, 34, 71, 0.17), inset 0px 0px 0px 1px #061530, inset 0px 0px 0px 2px rgba(255, 255, 255, 0.1)",
                        }}
                      >
                        <span> Continue </span>
                        <svg
                          className="w-5 h-5"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M13.75 6.75L19.25 12L13.75 17.25"
                            stroke="#FFF"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M19 12H4.75"
                            stroke="#FFF"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <p>Step 3</p>
              )}
            </div>
          </div>
          <div className="w-full h-[40vh] md:w-1/2 md:h-screen bg-[#F1F2F4] relative overflow-hidden">
            <svg
              id="texture"
              style={{ filter: "contrast(120%) brightness(120%)" }}
              className="fixed z-[1] w-full h-full opacity-[35%]"
            >
              <filter id="noise" data-v-1d260e0e="">
                <feTurbulence
                  type="fractalNoise"
                  baseFrequency=".8"
                  numOctaves="4"
                  stitchTiles="stitch"
                  data-v-1d260e0e=""
                ></feTurbulence>
                <feColorMatrix
                  type="saturate"
                  values="0"
                  data-v-1d260e0e=""
                ></feColorMatrix>
              </filter>
              <rect
                width="100%"
                height="100%"
                filter="url(#noise)"
                data-v-1d260e0e=""
              ></rect>
            </svg>
            <figure
              className="absolute md:top-1/2 ml-[-380px] md:ml-[0px] md:-mt-[240px] left-1/2 grid transform scale-[0.5] sm:scale-[0.6] md:scale-[130%] w-[760px] h-[540px] bg-[#f5f7f9] text-[9px] origin-[50%_15%] md:origin-[50%_25%] rounded-[15px] overflow-hidden p-2 z-20"
              style={{
                grid: "100%/repeat(1,calc(5px * 28)) 1fr",
                boxShadow:
                  "0 192px 136px rgba(26,43,59,.23),0 70px 50px rgba(26,43,59,.16),0 34px 24px rgba(26,43,59,.13),0 17px 12px rgba(26,43,59,.1),0 7px 5px rgba(26,43,59,.07), 0 50px 100px -20px rgb(50 50 93 / 25%), 0 30px 60px -30px rgb(0 0 0 / 30%), inset 0 -2px 6px 0 rgb(10 37 64 / 35%)",
              }}
            >
              <div className="z-20 absolute h-full w-full bg-transparent cursor-default"></div>
              <div
                className="bg-white flex flex-col text-[#1a2b3b] p-[18px] rounded-lg relative"
                style={{ boxShadow: "inset -1px 0 0 #fff" }}
              >
                <ul className="mb-auto list-none">
                  <li className="list-none flex items-center">
                    <p className="text-[12px] font-extrabold text-[#1E293B]">
                      Liftoff
                    </p>
                  </li>
                  <li className="mt-4 list-none flex items-center rounded-[9px] text-gray-900 py-[2px]">
                    <svg
                      className="h-4 w-4 text-gray-700"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      {" "}
                      <path
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                        d="M4.75 6.75C4.75 5.64543 5.64543 4.75 6.75 4.75H17.25C18.3546 4.75 19.25 5.64543 19.25 6.75V17.25C19.25 18.3546 18.3546 19.25 17.25 19.25H6.75C5.64543 19.25 4.75 18.3546 4.75 17.25V6.75Z"
                      ></path>{" "}
                      <path
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                        d="M9.75 8.75V19"
                      ></path>{" "}
                      <path
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                        d="M5 8.25H19"
                      ></path>{" "}
                    </svg>
                    <p className="ml-[3px] mr-[6px]">Home</p>
                  </li>
                  <li className="mt-1 list-none flex items-center rounded-[9px] text-gray-900 py-[4px]">
                    <svg
                      fill="none"
                      viewBox="0 0 24 24"
                      className="h-4 w-4 text-gray-700"
                    >
                      <path
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                        d="M4.75 6.75C4.75 5.64543 5.64543 4.75 6.75 4.75H17.25C18.3546 4.75 19.25 5.64543 19.25 6.75V17.25C19.25 18.3546 18.3546 19.25 17.25 19.25H6.75C5.64543 19.25 4.75 18.3546 4.75 17.25V6.75Z"
                      ></path>
                      <path
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                        d="M15.25 12L9.75 8.75V15.25L15.25 12Z"
                      ></path>
                    </svg>
                    <p className="ml-[3px] mr-[6px]">Interview Vault</p>
                    <div className="ml-auto text-[#121217] transform">
                      <svg
                        width="24"
                        height="24"
                        fill="none"
                        viewBox="0 0 24 24"
                        className="w-3 h-3 stroke-current fill-transparent rotate-180 transform"
                      >
                        <path
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="1.5"
                          d="M15.25 10.75L12 14.25L8.75 10.75"
                        ></path>
                      </svg>
                    </div>
                  </li>
                  <li className="mt-1 list-none flex items-center rounded-[3px] relative bg-white text-gray-600 w-full m-0 cursor-pointer hover:bg-[#F7F7F8] focus:outline-none py-[4px]">
                    <div className="bg-[#e8e8ed] pointer-events-none absolute left-[7px] z-10 top-1/2 h-[3px] w-[3px] rounded-full transform -translate-y-1/2"></div>
                    <div className="text-gray-600 truncate pr-4 pl-[18px]">
                      All Interviews
                    </div>
                    <div className="absolute w-[1px] bg-[#e8e8ed] left-[8px] top-[9px] bottom-0"></div>
                  </li>
                  <li className="list-none flex items-center rounded-[3px] relative bg-white text-gray-600 w-full m-0 cursor-pointer hover:bg-[#F7F7F8] focus:outline-none py-[4px]">
                    <div className="bg-[#e8e8ed] pointer-events-none absolute left-[7px] z-10 top-1/2 h-[3px] w-[3px] rounded-full transform -translate-y-1/2"></div>
                    <div className="text-gray-600 truncate pr-4 pl-[18px]">
                      Completed
                    </div>
                    <div className="absolute w-[1px] bg-[#e8e8ed] left-[8px] top-0 bottom-0"></div>
                  </li>
                  <li className="list-none flex items-center rounded-[3px] relative bg-gray-100 text-gray-600 w-full m-0 cursor-pointer hover:bg-[#F7F7F8] focus:outline-none py-[4px]">
                    <div className="bg-blue-600 pointer-events-none absolute left-[7px] z-10 top-1/2 h-[3px] w-[3px] rounded-full transform -translate-y-1/2"></div>
                    <div className="text-blue-600 truncate pr-4 pl-[18px]">
                      Question Bank
                    </div>
                    <div className="absolute w-[1px] bg-[#e8e8ed] left-[8px] top-0 bottom-[9px]"></div>
                  </li>
                  <li className="mt-1 list-none flex items-center rounded-[9px] text-gray-900 py-[4px]">
                    <svg
                      className="h-4 w-4 text-gray-700"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                        d="M4.75 6.75C4.75 5.64543 5.64543 4.75 6.75 4.75H17.25C18.3546 4.75 19.25 5.64543 19.25 6.75V17.25C19.25 18.3546 18.3546 19.25 17.25 19.25H6.75C5.64543 19.25 4.75 18.3546 4.75 17.25V6.75Z"
                      ></path>
                      <path
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                        d="M19 12L5 12"
                      ></path>
                    </svg>
                    <p className="ml-[3px] mr-[6px]">My Questions</p>
                  </li>
                  <li className="mt-1 list-none flex items-center rounded-[9px] text-gray-900 py-[4px]">
                    <svg
                      className="h-4 w-4 text-gray-700"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                        d="M5.78168 19.25H13.2183C13.7828 19.25 14.227 18.7817 14.1145 18.2285C13.804 16.7012 12.7897 14 9.5 14C6.21031 14 5.19605 16.7012 4.88549 18.2285C4.773 18.7817 5.21718 19.25 5.78168 19.25Z"
                      ></path>
                      <path
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                        d="M15.75 14C17.8288 14 18.6802 16.1479 19.0239 17.696C19.2095 18.532 18.5333 19.25 17.6769 19.25H16.75"
                      ></path>
                      <circle
                        cx="9.5"
                        cy="7.5"
                        r="2.75"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                      ></circle>
                      <path
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                        d="M14.75 10.25C16.2688 10.25 17.25 9.01878 17.25 7.5C17.25 5.98122 16.2688 4.75 14.75 4.75"
                      ></path>
                    </svg>
                    <p className="ml-[3px] mr-[6px]">Community</p>
                  </li>
                  <li className="mt-1 list-none flex items-center rounded-[9px] text-gray-900 py-[4px]">
                    <svg
                      className="h-4 w-4 text-gray-700"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                        d="M19.25 5.75C19.25 5.19772 18.8023 4.75 18.25 4.75H14C12.8954 4.75 12 5.64543 12 6.75V19.25L12.8284 18.4216C13.5786 17.6714 14.596 17.25 15.6569 17.25H18.25C18.8023 17.25 19.25 16.8023 19.25 16.25V5.75Z"
                      ></path>
                      <path
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                        d="M4.75 5.75C4.75 5.19772 5.19772 4.75 5.75 4.75H10C11.1046 4.75 12 5.64543 12 6.75V19.25L11.1716 18.4216C10.4214 17.6714 9.40401 17.25 8.34315 17.25H5.75C5.19772 17.25 4.75 16.8023 4.75 16.25V5.75Z"
                      ></path>
                    </svg>
                    <p className="ml-[3px] mr-[6px]">Resources</p>
                  </li>
                  <li className="mt-1 list-none flex items-center rounded-[9px] text-gray-900 py-[4px]">
                    <svg
                      className="h-4 w-4 text-gray-700"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                        d="M13.1191 5.61336C13.0508 5.11856 12.6279 4.75 12.1285 4.75H11.8715C11.3721 4.75 10.9492 5.11856 10.8809 5.61336L10.7938 6.24511C10.7382 6.64815 10.4403 6.96897 10.0622 7.11922C10.006 7.14156 9.95021 7.16484 9.89497 7.18905C9.52217 7.3524 9.08438 7.3384 8.75876 7.09419L8.45119 6.86351C8.05307 6.56492 7.49597 6.60451 7.14408 6.9564L6.95641 7.14408C6.60452 7.49597 6.56492 8.05306 6.86351 8.45118L7.09419 8.75876C7.33841 9.08437 7.3524 9.52216 7.18905 9.89497C7.16484 9.95021 7.14156 10.006 7.11922 10.0622C6.96897 10.4403 6.64815 10.7382 6.24511 10.7938L5.61336 10.8809C5.11856 10.9492 4.75 11.372 4.75 11.8715V12.1285C4.75 12.6279 5.11856 13.0508 5.61336 13.1191L6.24511 13.2062C6.64815 13.2618 6.96897 13.5597 7.11922 13.9378C7.14156 13.994 7.16484 14.0498 7.18905 14.105C7.3524 14.4778 7.3384 14.9156 7.09419 15.2412L6.86351 15.5488C6.56492 15.9469 6.60451 16.504 6.9564 16.8559L7.14408 17.0436C7.49597 17.3955 8.05306 17.4351 8.45118 17.1365L8.75876 16.9058C9.08437 16.6616 9.52216 16.6476 9.89496 16.811C9.95021 16.8352 10.006 16.8584 10.0622 16.8808C10.4403 17.031 10.7382 17.3519 10.7938 17.7549L10.8809 18.3866C10.9492 18.8814 11.3721 19.25 11.8715 19.25H12.1285C12.6279 19.25 13.0508 18.8814 13.1191 18.3866L13.2062 17.7549C13.2618 17.3519 13.5597 17.031 13.9378 16.8808C13.994 16.8584 14.0498 16.8352 14.105 16.8109C14.4778 16.6476 14.9156 16.6616 15.2412 16.9058L15.5488 17.1365C15.9469 17.4351 16.504 17.3955 16.8559 17.0436L17.0436 16.8559C17.3955 16.504 17.4351 15.9469 17.1365 15.5488L16.9058 15.2412C16.6616 14.9156 16.6476 14.4778 16.811 14.105C16.8352 14.0498 16.8584 13.994 16.8808 13.9378C17.031 13.5597 17.3519 13.2618 17.7549 13.2062L18.3866 13.1191C18.8814 13.0508 19.25 12.6279 19.25 12.1285V11.8715C19.25 11.3721 18.8814 10.9492 18.3866 10.8809L17.7549 10.7938C17.3519 10.7382 17.031 10.4403 16.8808 10.0622C16.8584 10.006 16.8352 9.95021 16.8109 9.89496C16.6476 9.52216 16.6616 9.08437 16.9058 8.75875L17.1365 8.4512C17.4351 8.05308 17.3955 7.49599 17.0436 7.1441L16.8559 6.95642C16.504 6.60453 15.9469 6.56494 15.5488 6.86353L15.2412 7.09419C14.9156 7.33841 14.4778 7.3524 14.105 7.18905C14.0498 7.16484 13.994 7.14156 13.9378 7.11922C13.5597 6.96897 13.2618 6.64815 13.2062 6.24511L13.1191 5.61336Z"
                      ></path>
                      <path
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                        d="M13.25 12C13.25 12.6904 12.6904 13.25 12 13.25C11.3096 13.25 10.75 12.6904 10.75 12C10.75 11.3096 11.3096 10.75 12 10.75C12.6904 10.75 13.25 11.3096 13.25 12Z"
                      ></path>
                    </svg>
                    <p className="ml-[3px] mr-[6px]">Settings</p>
                  </li>
                </ul>
                <ul className="flex flex-col mb-[10px]">
                  <hr className="border-[#e8e8ed] w-full" />
                  <li className="mt-1 list-none flex items-center rounded-[9px] text-gray-900 py-[2px]">
                    <div className="h-4 w-4 bg-[#898FA9] rounded-full flex-shrink-0 text-white inline-flex items-center justify-center text-[7px] leading-[6px] pl-[0.5px]">
                      R
                    </div>
                    <p className="ml-[4px] mr-[6px] flex-shrink-0">
                      Richard Monroe
                    </p>
                    <div className="ml-auto">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <path
                          fill="currentColor"
                          d="M13 12C13 12.5523 12.5523 13 12 13C11.4477 13 11 12.5523 11 12C11 11.4477 11.4477 11 12 11C12.5523 11 13 11.4477 13 12Z"
                        ></path>
                        <path
                          fill="currentColor"
                          d="M9 12C9 12.5523 8.55228 13 8 13C7.44772 13 7 12.5523 7 12C7 11.4477 7.44772 11 8 11C8.55228 11 9 11.4477 9 12Z"
                        ></path>
                        <path
                          fill="currentColor"
                          d="M17 12C17 12.5523 16.5523 13 16 13C15.4477 13 15 12.5523 15 12C15 11.4477 15.4477 11 16 11C16.5523 11 17 11.4477 17 12Z"
                        ></path>
                      </svg>
                    </div>
                  </li>
                </ul>
              </div>
              <div className="bg-white text-[#667380] p-[18px] flex flex-col">
                {step === 1 ? (
                  <div>
                    <motion.span
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                      key={selected.id}
                      className="text-[#1a2b3b] text-[14px] leading-[18px] font-semibold absolute"
                    >
                      {selected.name} Questions
                    </motion.span>

                    <ul className="mt-[28px] flex">
                      <li className="list-none max-w-[400px]">
                        Search through all of the questions in the question
                        bank. If you don{`'`}t see one you{`'`}re looking for,
                        you can always add it in your the {`"`}My Questions{`"`}{" "}
                        section.
                      </li>
                    </ul>
                  </div>
                ) : (
                  <div>
                    <motion.span
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                      key={selected.id}
                      className="text-[#1a2b3b] text-[14px] leading-[18px] font-semibold absolute"
                    >
                      {selected.name === "Behavioral"
                        ? "Tell me about yourself"
                        : selectedInterviewer.name === "John"
                        ? "What is a Hash Table, and what is the average case for each of its operations?"
                        : selectedInterviewer.name === "Richard"
                        ? "Uber is looking to expand its product line. How would you go about doing this?"
                        : "You have a 3-gallon jug and 5-gallon jug, how do you measure out exactly 4 gallons?"}
                    </motion.span>

                    <ul className="mt-[28px] flex">
                      {selected.name === "Behavioral" ? (
                        <li className="list-none max-w-[400px]">
                          Start off by walking me through your resume. Perhaps
                          begin with your internships in college and move to
                          more recent projects.
                        </li>
                      ) : (
                        <li className="list-none max-w-[400px]">
                          Start off by explaining what the function does, and
                          its time and space complexities. Then go into how you
                          would optimize it.
                        </li>
                      )}
                    </ul>
                  </div>
                )}
                {step === 2 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                    className="mt-[12px] flex bg-gray-100 h-[80%] rounded-lg relative ring-1 ring-gray-900/5 shadow-md"
                  >
                    {selectedInterviewer.name === "John" ? (
                      <motion.img
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                        key="John"
                        src="/placeholders/John.webp"
                        alt="John's Interviewer Profile"
                        className="absolute top-6 left-6 w-[30%] aspect-video bg-gray-700 rounded ring-1 ring-gray-900/5 shadow-md object-cover"
                      />
                    ) : selectedInterviewer.name === "Richard" ? (
                      <motion.img
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                        key="Richard"
                        src="/placeholders/Richard.webp"
                        alt="Richard's Interviewer Profile"
                        className="absolute top-6 left-6 w-[30%] aspect-video bg-gray-700 rounded ring-1 ring-gray-900/5 shadow-md object-cover"
                      />
                    ) : selectedInterviewer.name === "Sarah" ? (
                      <motion.img
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                        key="Sarah"
                        src="/placeholders/Sarah.webp"
                        alt="Sarah's Interviewer Profile"
                        className="absolute top-6 left-6 w-[30%] aspect-video bg-gray-700 rounded ring-1 ring-gray-900/5 shadow-md object-cover"
                      />
                    ) : (
                      <div className="absolute top-6 left-6 w-[30%] aspect-video bg-gray-700 rounded"></div>
                    )}
                    <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 translate-y-1/2 w-8 h-8 md:w-12 md:h-12 bg-red-400 ring-4 ring-white rounded-full"></div>
                  </motion.div>
                )}
                {step === 1 && (
                  <ul className="mt-[12px] flex items-center space-x-[2px]">
                    <svg
                      className="w-4 h-4 text-[#1a2b3b]"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                        d="M19.25 19.25L15.5 15.5M4.75 11C4.75 7.54822 7.54822 4.75 11 4.75C14.4518 4.75 17.25 7.54822 17.25 11C17.25 14.4518 14.4518 17.25 11 17.25C7.54822 17.25 4.75 14.4518 4.75 11Z"
                      ></path>
                    </svg>

                    <p>Search</p>
                  </ul>
                )}
                {step === 1 &&
                  (selected.name === "Behavioral" ? (
                    <motion.ul
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                      key={selected.id}
                      className="mt-3 grid grid-cols-3 xl:grid-cols-3 gap-2"
                    >
                      <li className="list-none relative flex items-stretch text-left">
                        <div className="group relative w-full">
                          <div className="relative mb-2 flex h-full max-h-[200px] w-full cursor-pointer items-start justify-between rounded-lg p-2 font-medium transition duration-100">
                            <div className="absolute inset-0 rounded-lg ring-1 ring-inset ring-zinc-900/[7.5%] group-hover:ring-zinc-900/10"></div>
                            <div className="relative flex h-full flex-col overflow-hidden">
                              <div className="flex items-center text-left text-[#1a2b3b]">
                                <p>Why this company?</p>
                              </div>
                              <p className="text-wrap grow font-normal text-[7px]">
                                Why do you want to work for Google?
                              </p>
                              <div className="flex flex-row space-x-1">
                                <p className="inline-flex items-center justify-center truncate rounded-full border-[0.5px] border-gray-300 px-[3px] text-[7px] font-normal hover:bg-gray-50">
                                  Product Management
                                </p>
                                <p className="inline-flex items-center justify-center truncate rounded-full border-[0.5px] border-[#D0E7DC] bg-[#F3FAF1] px-[3px] text-[7px] font-normal hover:bg-[#edf8ea]">
                                  <span className="mr-1 flex items-center text-emerald-600">
                                    <svg
                                      className="h-2 w-2"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      xmlns="http://www.w3.org/2000/svg"
                                    >
                                      <path
                                        d="M4.75 12C4.75 7.99594 7.99594 4.75 12 4.75C16.0041 4.75 19.25 7.99594 19.25 12C19.25 16.0041 16.0041 19.25 12 19.25C7.99594 19.25 4.75 16.0041 4.75 12Z"
                                        fill="#459A5F"
                                        stroke="#459A5F"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      ></path>
                                      <path
                                        d="M9.75 12.75L10.1837 13.6744C10.5275 14.407 11.5536 14.4492 11.9564 13.7473L14.25 9.75"
                                        stroke="#F4FAF4"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      ></path>
                                    </svg>
                                  </span>
                                  Completed
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                      <li className="list-none relative flex items-stretch text-left">
                        <div className="group relative w-full">
                          <div className="relative mb-2 flex h-full max-h-[200px] w-full cursor-pointer items-start justify-between rounded-lg p-2 font-medium transition duration-100">
                            <div className="absolute inset-0 rounded-lg ring-1 ring-inset ring-zinc-900/[7.5%] group-hover:ring-zinc-900/10"></div>
                            <div className="relative flex h-full flex-col overflow-hidden">
                              <div className="flex items-center text-left text-[#1a2b3b]">
                                <p>What are you most proud of?</p>
                              </div>
                              <p className="text-wrap grow font-normal text-[7px]">
                                Tell me about the thing you are most proud of.
                                Why is it so important to you?
                              </p>
                              <div className="flex flex-row space-x-1">
                                <p className="inline-flex items-center justify-center truncate rounded-full border-[0.5px] border-gray-300 px-[3px] text-[7px] font-normal hover:bg-gray-50">
                                  General
                                </p>
                                <p className="inline-flex items-center justify-center truncate rounded-full border-[0.5px] border-[#D0E7DC] bg-[#F3FAF1] px-[3px] text-[7px] font-normal hover:bg-[#edf8ea]">
                                  <span className="mr-1 flex items-center text-emerald-600">
                                    <svg
                                      className="h-2 w-2"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      xmlns="http://www.w3.org/2000/svg"
                                    >
                                      <path
                                        d="M4.75 12C4.75 7.99594 7.99594 4.75 12 4.75C16.0041 4.75 19.25 7.99594 19.25 12C19.25 16.0041 16.0041 19.25 12 19.25C7.99594 19.25 4.75 16.0041 4.75 12Z"
                                        fill="#459A5F"
                                        stroke="#459A5F"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      ></path>
                                      <path
                                        d="M9.75 12.75L10.1837 13.6744C10.5275 14.407 11.5536 14.4492 11.9564 13.7473L14.25 9.75"
                                        stroke="#F4FAF4"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      ></path>
                                    </svg>
                                  </span>
                                  Completed
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                      <li className="list-none relative flex items-stretch text-left">
                        <div className="group relative w-full">
                          <div className="relative mb-2 flex h-full max-h-[200px] w-full cursor-pointer items-start justify-between rounded-lg p-2 font-medium transition duration-100">
                            <div className="absolute inset-0 rounded-lg ring-1 ring-inset ring-zinc-900/[7.5%] group-hover:ring-zinc-900/10"></div>
                            <div className="relative flex h-full flex-col overflow-hidden">
                              <div className="flex items-center text-left text-[#1a2b3b]">
                                <p>Tell me about yourself</p>
                              </div>
                              <p className="text-wrap grow font-normal text-[7px]">
                                Walk me through your resume, projects, and
                                anything you feel is relevant to your story.
                              </p>
                              <div className="flex flex-row space-x-1">
                                <p className="inline-flex items-center justify-center truncate rounded-full border-[0.5px] border-gray-300 px-[3px] text-[7px] font-normal hover:bg-gray-50">
                                  Product Management
                                </p>
                                <p className="inline-flex items-center justify-center truncate rounded-full border-[0.5px] border-[#D0E7DC] bg-[#F3FAF1] px-[3px] text-[7px] font-normal hover:bg-[#edf8ea]">
                                  <span className="mr-1 flex items-center text-emerald-600">
                                    <svg
                                      className="h-2 w-2"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      xmlns="http://www.w3.org/2000/svg"
                                    >
                                      <path
                                        d="M4.75 12C4.75 7.99594 7.99594 4.75 12 4.75C16.0041 4.75 19.25 7.99594 19.25 12C19.25 16.0041 16.0041 19.25 12 19.25C7.99594 19.25 4.75 16.0041 4.75 12Z"
                                        fill="#459A5F"
                                        stroke="#459A5F"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      ></path>
                                      <path
                                        d="M9.75 12.75L10.1837 13.6744C10.5275 14.407 11.5536 14.4492 11.9564 13.7473L14.25 9.75"
                                        stroke="#F4FAF4"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      ></path>
                                    </svg>
                                  </span>
                                  Completed
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                      <li className="list-none relative flex items-stretch text-left">
                        <div className="group relative w-full">
                          <div className="relative mb-2 flex h-full max-h-[200px] w-full cursor-pointer items-start justify-between rounded-lg p-2 font-medium transition duration-100">
                            <div className="absolute inset-0 rounded-lg ring-1 ring-inset ring-zinc-900/[7.5%] group-hover:ring-zinc-900/10"></div>
                            <div className="relative flex h-full flex-col overflow-hidden">
                              <div className="flex items-center text-left text-[#1a2b3b]">
                                <p>What are your strengths?</p>
                              </div>
                              <p className="text-wrap grow font-normal text-[7px]">
                                Tell me about your strengths and why you would
                                make a strong candidate.
                              </p>
                              <div className="flex flex-row space-x-1">
                                <p className="inline-flex items-center justify-center truncate rounded-full border-[0.5px] border-gray-300 px-[3px] text-[7px] font-normal hover:bg-gray-50">
                                  Software Engineering
                                </p>
                                <p className="inline-flex items-center justify-center truncate rounded-full border-[0.5px] border-[#D0E7DC] bg-[#F3FAF1] px-[3px] text-[7px] font-normal hover:bg-[#edf8ea]">
                                  <span className="mr-1 flex items-center text-emerald-600">
                                    <svg
                                      className="h-2 w-2"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      xmlns="http://www.w3.org/2000/svg"
                                    >
                                      <path
                                        d="M4.75 12C4.75 7.99594 7.99594 4.75 12 4.75C16.0041 4.75 19.25 7.99594 19.25 12C19.25 16.0041 16.0041 19.25 12 19.25C7.99594 19.25 4.75 16.0041 4.75 12Z"
                                        fill="#459A5F"
                                        stroke="#459A5F"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      ></path>
                                      <path
                                        d="M9.75 12.75L10.1837 13.6744C10.5275 14.407 11.5536 14.4492 11.9564 13.7473L14.25 9.75"
                                        stroke="#F4FAF4"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      ></path>
                                    </svg>
                                  </span>
                                  Completed
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                      <li className="list-none relative flex items-stretch text-left">
                        <div className="group relative w-full">
                          <div className="relative mb-2 flex h-full max-h-[200px] w-full cursor-pointer items-start justify-between rounded-lg p-2 font-medium transition duration-100">
                            <div className="absolute inset-0 rounded-lg ring-1 ring-inset ring-zinc-900/[7.5%] group-hover:ring-zinc-900/10"></div>
                            <div className="relative flex h-full flex-col overflow-hidden">
                              <div className="flex items-center text-left text-[#1a2b3b]">
                                <p>What are your weaknesses?</p>
                              </div>
                              <p className="text-wrap grow font-normal text-[7px]">
                                Tell me about your weaknesses, and how that has
                                impacted your previous work.
                              </p>
                              <div className="flex flex-row space-x-1">
                                <p className="inline-flex items-center justify-center truncate rounded-full border-[0.5px] border-gray-300 px-[3px] text-[7px] font-normal hover:bg-gray-50">
                                  Product Management
                                </p>
                                <p className="inline-flex items-center justify-center truncate rounded-full border-[0.5px] border-[#D0E7DC] bg-[#F3FAF1] px-[3px] text-[7px] font-normal hover:bg-[#edf8ea]">
                                  <span className="mr-1 flex items-center text-emerald-600">
                                    <svg
                                      className="h-2 w-2"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      xmlns="http://www.w3.org/2000/svg"
                                    >
                                      <path
                                        d="M4.75 12C4.75 7.99594 7.99594 4.75 12 4.75C16.0041 4.75 19.25 7.99594 19.25 12C19.25 16.0041 16.0041 19.25 12 19.25C7.99594 19.25 4.75 16.0041 4.75 12Z"
                                        fill="#459A5F"
                                        stroke="#459A5F"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      ></path>
                                      <path
                                        d="M9.75 12.75L10.1837 13.6744C10.5275 14.407 11.5536 14.4492 11.9564 13.7473L14.25 9.75"
                                        stroke="#F4FAF4"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      ></path>
                                    </svg>
                                  </span>
                                  Completed
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                    </motion.ul>
                  ) : (
                    <motion.ul
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                      key={selected.id}
                      className="mt-3 grid grid-cols-3 xl:grid-cols-3 gap-2"
                    >
                      <li className="list-none relative flex items-stretch text-left">
                        <div className="group relative w-full">
                          <div className="relative mb-2 flex h-full max-h-[200px] w-full cursor-pointer items-start justify-between rounded-lg p-2 font-medium transition duration-100">
                            <div className="absolute inset-0 rounded-lg ring-1 ring-inset ring-zinc-900/[7.5%] group-hover:ring-zinc-900/10"></div>
                            <div className="relative flex h-full flex-col overflow-hidden">
                              <div className="flex items-center text-left text-[#1a2b3b]">
                                <p>Walk me through this function</p>
                              </div>
                              <p className="text-wrap grow font-normal text-[7px]">
                                Explain in as much detail as you can what this
                                function does, including its time and space...
                              </p>
                              <div className="flex flex-row space-x-1">
                                <p className="inline-flex items-center justify-center truncate rounded-full border-[0.5px] border-gray-300 px-[3px] text-[7px] font-normal hover:bg-gray-50">
                                  Software Engineering
                                </p>
                                <p className="inline-flex items-center justify-center truncate rounded-full border-[0.5px] border-[#D0E7DC] bg-[#F3FAF1] px-[3px] text-[7px] font-normal hover:bg-[#edf8ea]">
                                  <span className="mr-1 flex items-center text-emerald-600">
                                    <svg
                                      className="h-2 w-2"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      xmlns="http://www.w3.org/2000/svg"
                                    >
                                      <path
                                        d="M4.75 12C4.75 7.99594 7.99594 4.75 12 4.75C16.0041 4.75 19.25 7.99594 19.25 12C19.25 16.0041 16.0041 19.25 12 19.25C7.99594 19.25 4.75 16.0041 4.75 12Z"
                                        fill="#459A5F"
                                        stroke="#459A5F"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      ></path>
                                      <path
                                        d="M9.75 12.75L10.1837 13.6744C10.5275 14.407 11.5536 14.4492 11.9564 13.7473L14.25 9.75"
                                        stroke="#F4FAF4"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      ></path>
                                    </svg>
                                  </span>
                                  Completed
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                      <li className="list-none relative flex items-stretch text-left">
                        <div className="group relative w-full">
                          <div className="relative mb-2 flex h-full max-h-[200px] w-full cursor-pointer items-start justify-between rounded-lg p-2 font-medium transition duration-100">
                            <div className="absolute inset-0 rounded-lg ring-1 ring-inset ring-zinc-900/[7.5%] group-hover:ring-zinc-900/10"></div>
                            <div className="relative flex h-full flex-col overflow-hidden">
                              <div className="flex items-center text-left text-[#1a2b3b]">
                                <p>Uber product expansion</p>
                              </div>
                              <p className="text-wrap grow font-normal text-[7px]">
                                Uber is looking to expand its product line and
                                wants your take on how...
                              </p>
                              <div className="flex flex-row space-x-1">
                                <p className="inline-flex items-center justify-center truncate rounded-full border-[0.5px] border-gray-300 px-[3px] text-[7px] font-normal hover:bg-gray-50">
                                  Product Management
                                </p>
                                <p className="inline-flex items-center justify-center truncate rounded-full border-[0.5px] border-[#D0E7DC] bg-[#F3FAF1] px-[3px] text-[7px] font-normal hover:bg-[#edf8ea]">
                                  <span className="mr-1 flex items-center text-emerald-600">
                                    <svg
                                      className="h-2 w-2"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      xmlns="http://www.w3.org/2000/svg"
                                    >
                                      <path
                                        d="M4.75 12C4.75 7.99594 7.99594 4.75 12 4.75C16.0041 4.75 19.25 7.99594 19.25 12C19.25 16.0041 16.0041 19.25 12 19.25C7.99594 19.25 4.75 16.0041 4.75 12Z"
                                        fill="#459A5F"
                                        stroke="#459A5F"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      ></path>
                                      <path
                                        d="M9.75 12.75L10.1837 13.6744C10.5275 14.407 11.5536 14.4492 11.9564 13.7473L14.25 9.75"
                                        stroke="#F4FAF4"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      ></path>
                                    </svg>
                                  </span>
                                  Completed
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                      <li className="list-none relative flex items-stretch text-left">
                        <div className="group relative w-full">
                          <div className="relative mb-2 flex h-full max-h-[200px] w-full cursor-pointer items-start justify-between rounded-lg p-2 font-medium transition duration-100">
                            <div className="absolute inset-0 rounded-lg ring-1 ring-inset ring-zinc-900/[7.5%] group-hover:ring-zinc-900/10"></div>
                            <div className="relative flex h-full flex-col overflow-hidden">
                              <div className="flex items-center text-left text-[#1a2b3b]">
                                <p>Weighing an Airplane</p>
                              </div>
                              <p className="text-wrap grow font-normal text-[7px]">
                                How would you weigh a plane without a scale?
                              </p>
                              <div className="flex flex-row space-x-1">
                                <p className="inline-flex items-center justify-center truncate rounded-full border-[0.5px] border-gray-300 px-[3px] text-[7px] font-normal hover:bg-gray-50">
                                  Brainteaser
                                </p>
                                <p className="inline-flex items-center justify-center truncate rounded-full border-[0.5px] border-[#D0E7DC] bg-[#F3FAF1] px-[3px] text-[7px] font-normal hover:bg-[#edf8ea]">
                                  <span className="mr-1 flex items-center text-emerald-600">
                                    <svg
                                      className="h-2 w-2"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      xmlns="http://www.w3.org/2000/svg"
                                    >
                                      <path
                                        d="M4.75 12C4.75 7.99594 7.99594 4.75 12 4.75C16.0041 4.75 19.25 7.99594 19.25 12C19.25 16.0041 16.0041 19.25 12 19.25C7.99594 19.25 4.75 16.0041 4.75 12Z"
                                        fill="#459A5F"
                                        stroke="#459A5F"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      ></path>
                                      <path
                                        d="M9.75 12.75L10.1837 13.6744C10.5275 14.407 11.5536 14.4492 11.9564 13.7473L14.25 9.75"
                                        stroke="#F4FAF4"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      ></path>
                                    </svg>
                                  </span>
                                  Completed
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                      <li className="list-none relative flex items-stretch text-left">
                        <div className="group relative w-full">
                          <div className="relative mb-2 flex h-full max-h-[200px] w-full cursor-pointer items-start justify-between rounded-lg p-2 font-medium transition duration-100">
                            <div className="absolute inset-0 rounded-lg ring-1 ring-inset ring-zinc-900/[7.5%] group-hover:ring-zinc-900/10"></div>
                            <div className="relative flex h-full flex-col overflow-hidden">
                              <div className="flex items-center text-left text-[#1a2b3b]">
                                <p>How would you rebuild Twitter?</p>
                              </div>
                              <p className="text-wrap grow font-normal text-[7px]">
                                Given what you know about Twitter, how would you
                                architect it from the ground up?
                              </p>
                              <div className="flex flex-row space-x-1">
                                <p className="inline-flex items-center justify-center truncate rounded-full border-[0.5px] border-gray-300 px-[3px] text-[7px] font-normal hover:bg-gray-50">
                                  Systems Design
                                </p>
                                <p className="inline-flex items-center justify-center truncate rounded-full border-[0.5px] border-[#D0E7DC] bg-[#F3FAF1] px-[3px] text-[7px] font-normal hover:bg-[#edf8ea]">
                                  <span className="mr-1 flex items-center text-emerald-600">
                                    <svg
                                      className="h-2 w-2"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      xmlns="http://www.w3.org/2000/svg"
                                    >
                                      <path
                                        d="M4.75 12C4.75 7.99594 7.99594 4.75 12 4.75C16.0041 4.75 19.25 7.99594 19.25 12C19.25 16.0041 16.0041 19.25 12 19.25C7.99594 19.25 4.75 16.0041 4.75 12Z"
                                        fill="#459A5F"
                                        stroke="#459A5F"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      ></path>
                                      <path
                                        d="M9.75 12.75L10.1837 13.6744C10.5275 14.407 11.5536 14.4492 11.9564 13.7473L14.25 9.75"
                                        stroke="#F4FAF4"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      ></path>
                                    </svg>
                                  </span>
                                  Completed
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                    </motion.ul>
                  ))}
                {step === 1 && (
                  <div className="space-y-2 md:space-y-5 mt-auto">
                    <nav
                      className="flex items-center justify-between border-t border-gray-200 bg-white px-1 py-[2px] mb-[10px]"
                      aria-label="Pagination"
                    >
                      <div className="hidden sm:block">
                        <p className=" text-[#1a2b3b]">
                          Showing <span className="font-medium">1</span> to{" "}
                          <span className="font-medium">9</span> of{" "}
                          <span className="font-medium">500</span> results
                        </p>
                      </div>
                      <div className="flex flex-1 justify-between sm:justify-end">
                        <button className="relative inline-flex cursor-auto items-center rounded border border-gray-300 bg-white px-[4px] py-[2px]  font-medium text-[#1a2b3b] hover:bg-gray-50 disabled:opacity-50">
                          Previous
                        </button>
                        <button className="relative ml-3 inline-flex items-center rounded border border-gray-300 bg-white px-[4px] py-[2px]  font-medium text-[#1a2b3b] hover:bg-gray-50">
                          Next
                        </button>
                      </div>
                    </nav>
                  </div>
                )}
              </div>
            </figure>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}

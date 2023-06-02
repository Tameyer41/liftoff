<a href="https://demo.useliftoff.com">
  <img alt="Liftoff – AI-Powered Mock Interviews" src="https://demo.useliftoff.com/opengraph-image">
  <h1 align="center">Liftoff Interviews</h1>
</a>

<p align="center">
  Mock Interview Simulator with AI-Powered Feedback
</p>

<p align="center">
  <a href="https://twitter.com/tmeyer_me">
    <img src="https://img.shields.io/twitter/follow/tmeyer_me?style=flat&label=Follow&logo=twitter&color=0bf&logoColor=fff" alt="Tyler Meyer's follower count" />
  </a>
  <a href="https://github.com/Tameyer41/liftoff">
    <img src="https://img.shields.io/github/stars/Tameyer41/liftoff?label=Tameyer41%2Fliftoff" alt="Liftoff repo star count" />
  </a>
</p>

<p align="center">
  <a href="#introduction"><strong>Introduction</strong></a> ·
  <a href="#one-click-deploy"><strong>One-click Deploy</strong></a> ·
  <a href="#tech-stack--features"><strong>Tech Stack + Features</strong></a> ·
  <a href="#author"><strong>Author</strong></a>
</p>
<br/>

## Introduction

Liftoff is an interview preparation tool that provides AI feedback on your mock interviews.

## One-click Deploy

You can deploy this template to Vercel with the button below:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FTameyer41%2Fliftoff&env=OPENAI_API_KEY,UPSTASH_REDIS_REST_URL,UPSTASH_REDIS_REST_TOKEN&envDescription=API%20Keys%20needed%20for%20the%20application%3B%20OpenAI%20for%20feedback%20and%20transcription%2C%20and%20Upstash%20for%20rate%20limiting&envLink=https%3A%2F%2Fplatform.openai.com%2Faccount%2Fapi-keys&project-name=liftoff&repository-name=liftoff&demo-title=Liftoff%20-%20AI-Powered%20Mock%20Interviews&demo-description=An%20AI-powered%20mock%20interview%20platform%20that%20helps%20you%20practice%20for%20your%20next%20job%20interview.&demo-url=https%3A%2F%2Fdemo.useliftoff.com%2F&demo-image=https%3A%2F%2Fik.imagekit.io%2F9km72asqu%2FCleanShot_2023-05-31_at_12.43.54_svKkqF7dA.png%3FupdatedAt%3D1685551454273)

You can also clone & create this repo locally with the following command:

```bash
npx create-next-app liftoff --example "https://github.com/Tameyer41/liftoff"
```

## Tech Stack + Features

![Landing Page](https://ik.imagekit.io/9km72asqu/CleanShot_2023-05-31_at_12.43.54_svKkqF7dA.png?updatedAt=1685551454273)

![Interview Selection](https://ik.imagekit.io/9km72asqu/CleanShot_2023-05-31_at_13.35.55_xohCRNMlJ.png?updatedAt=1685554576155)

### Frameworks

- [Next.js](https://nextjs.org/) – React framework for building performant apps with the best developer experience

### Platforms

- [Vercel](https://vercel.com/) – Easily preview & deploy changes with git
- [Upstash](https://upstash.com/) - Serverless Data Platform (here using serverless Redis for rate limiting)

### UI

- [Tailwind CSS](https://tailwindcss.com/) – Utility-first CSS framework for rapid UI development
- [Framer Motion](https://framer.com/motion) – Motion library for React to animate components with ease
- [`ImageResponse`](https://beta.nextjs.org/docs/api-reference/image-response) – Generate dynamic Open Graph images at the edge
- [HeadlessUI](https://headlessui.com/) - Completely unstyled, fully accessible UI components, designed to integrate beautifully with Tailwind CSS

### Code Quality

- [TypeScript](https://www.typescriptlang.org/) – Static type checker for end-to-end typesafety
- [Prettier](https://prettier.io/) – Opinionated code formatter for consistent code style
- [ESLint](https://eslint.org/) – Pluggable linter for Next.js and TypeScript

### Miscellaneous

- [FFMPEG.WASM](https://ffmpegwasm.netlify.app/) – Transcode video/audio files
- [React Webcam](https://github.com/mozmorris/react-webcam) - Webcam component for React
- [Stripe Gradient Animation](https://whatamesh.vercel.app/) - [@jordienr](https://twitter.com/jordienr) released a Mesh Gradient that uses WebGL and animates a beautiful gradient

## How it all works

Liftoff uses FFmpeg to transcode the raw video into MP3. Chrome, Safari, and Firefox all record with different codecs, and FFmpeg is great for standardizing them.

We then send the audio directly to be transcribed by OpenAI's Whisper endpoint, and then stream feedback from the edge using OpenAI's gpt-3.5-turbo.

## Author

- Tyler Meyer ([@tmeyer_me](https://twitter.com/tmeyer_me))

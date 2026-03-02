import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const { video_url, capture_keywords = ["capture", "screenshot"] } =
      await req.json();

    if (!video_url) {
      throw new Error("video_url is required");
    }

    // 1. Download the video from Supabase Storage
    const videoResp = await fetch(video_url);
    if (!videoResp.ok) {
      throw new Error(`Failed to fetch video: ${videoResp.status}`);
    }

    const videoBlob = await videoResp.blob();
    const sizeMB = videoBlob.size / (1024 * 1024);
    if (sizeMB > 25) {
      throw new Error(
        `Video is ${sizeMB.toFixed(1)}MB. Maximum supported size is 25MB.`
      );
    }

    // Determine a filename from the URL
    const urlPath = new URL(video_url).pathname;
    const filename = urlPath.split("/").pop() || "audio.wav";

    // 2. Transcribe with Whisper (word-level timestamps)
    const whisperForm = new FormData();
    whisperForm.append("file", videoBlob, filename);
    whisperForm.append("model", "whisper-1");
    whisperForm.append("response_format", "verbose_json");
    whisperForm.append("timestamp_granularities[]", "word");

    const whisperResp = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
        body: whisperForm,
      }
    );

    if (!whisperResp.ok) {
      const errBody = await whisperResp.text();
      throw new Error(`Whisper API error ${whisperResp.status}: ${errBody}`);
    }

    const whisperData = await whisperResp.json();
    const transcript: string = whisperData.text || "";
    const words: Array<{ word: string; start: number; end: number }> =
      whisperData.words || [];

    // 3. Find capture keyword timestamps and build annotated transcript
    const lowerKeywords = capture_keywords.map((k: string) => k.toLowerCase());
    const captureTimestamps: number[] = [];
    let annotatedTranscript = "";

    for (const w of words) {
      annotatedTranscript += w.word + " ";
      const cleaned = w.word.replace(/[^a-zA-Z]/g, "").toLowerCase();
      if (lowerKeywords.includes(cleaned)) {
        annotatedTranscript += `[CAPTURE #${captureTimestamps.length}] `;
        captureTimestamps.push(w.end);
      }
    }
    annotatedTranscript = annotatedTranscript.trim();

    // 4. Generate task list with GPT
    const gptResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You convert video transcripts into actionable task lists.

Rules:
- Extract clear, concise tasks. Each task has a title (short, imperative) and description (1-2 sentences).
- The transcript contains [CAPTURE #N] markers. These mark where the speaker requested a screenshot. N is the 0-based index.
- Assign ALL [CAPTURE #N] markers that appear within or immediately after a task's description to that task's capture_indices array.
- A single task can have MULTIPLE captures. For example if the transcript says "move the table [CAPTURE #0] over here [CAPTURE #1]", that ONE task gets capture_indices: [0, 1].
- Do NOT skip any capture markers. Every [CAPTURE #N] must appear in exactly one task's capture_indices.
- Return JSON: { "tasks": [ { "title": "...", "description": "...", "capture_indices": [0, 1] } ] }`,
          },
          {
            role: "user",
            content: `Transcript:\n${annotatedTranscript}\n\nTotal captures: ${captureTimestamps.length}\n\nGenerate the task list.`,
          },
        ],
      }),
    });

    if (!gptResp.ok) {
      const errBody = await gptResp.text();
      throw new Error(`GPT API error ${gptResp.status}: ${errBody}`);
    }

    const gptData = await gptResp.json();
    let tasks: Array<{
      title: string;
      description: string;
      capture_indices: number[];
    }> = [];

    try {
      const parsed = JSON.parse(gptData.choices[0].message.content);
      tasks = (parsed.tasks || []).map((t: any) => ({
        ...t,
        capture_indices: t.capture_indices || (t.capture_index != null ? [t.capture_index] : [])
      }));
    } catch {
      console.error(
        "Failed to parse GPT response:",
        gptData.choices[0]?.message?.content
      );
      tasks = [];
    }

    return new Response(
      JSON.stringify({
        transcript,
        words,
        tasks,
        capture_timestamps: captureTimestamps,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});

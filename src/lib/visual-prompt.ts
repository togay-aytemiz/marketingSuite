import { getSingleOutputLanguageName } from './app-language';

export const buildPrompt = (
  images: string[],
  productName: string,
  featureName: string,
  description: string,
  headline: string,
  subheadline: string,
  cta: string,
  brandColor: string,
  campaignType: string,
  aspectRatio: string,
  tone: string,
  designStyle: string,
  mode: string,
  language: string,
  customInstruction: string,
  campaignFocus: string,
  variationIndex: number = 0,
  previousImage?: string,
  userComment?: string,
  referenceImage?: string | null
): string => {
  const outputLanguage = getSingleOutputLanguageName(language);
  const variationStyles = [
    "Clean, professional, and conversion-focused. Minimalist layout with clear hierarchy.",
    "Bold, modern, and energetic. Perfect for social media feeds. High contrast and dynamic composition.",
    "Elegant, premium, and feature-focused. Soft lighting, sophisticated typography, and a high-end feel.",
    "OUT OF THE BOX & HIGHLY CREATIVE. Break the rules. Use abstract concepts, 3D elements, or surreal compositions that still strongly drive the CTA. Make it visually striking and unforgettable."
  ];
  
  const stylePrompt = variationStyles[variationIndex % 4];

  let feedbackInstruction = "";
  if (userComment) {
    feedbackInstruction = `\n\nCRITICAL USER FEEDBACK ON PREVIOUS VERSION:\n"${userComment}"\nYou MUST incorporate this feedback into the new design while maintaining the overall quality.`;
  }

  let campaignTypeInstruction = "";
  if (campaignType.toLowerCase().includes("feature announcement")) {
    campaignTypeInstruction = "CAMPAIGN: FEATURE ANNOUNCEMENT. Focus heavily on the 'NEW' aspect. Highlight the specific new feature as the absolute center of attention. Use subtle visual cues like glowing edges, a spotlight effect, or a tasteful 'New' badge to draw the eye directly to the feature.";
  } else if (campaignType.toLowerCase().includes("product promotion")) {
    campaignTypeInstruction = "CAMPAIGN: PRODUCT PROMOTION. Grand, cinematic, and celebratory. The product should look like a highly anticipated blockbuster release. Use premium studio lighting, a strong sense of scale, and a composition that makes the product look incredibly valuable.";
  } else if (campaignType.toLowerCase().includes("update release")) {
    campaignTypeInstruction = "CAMPAIGN: UPDATE RELEASE. Show progress, speed, and improvement. Clean, iterative, and focused on the 'upgrade' feeling. You may use subtle visual metaphors for speed or enhancement (e.g., sleek motion lines or glowing success indicators).";
  } else if (campaignType.toLowerCase().includes("tutorial")) {
    campaignTypeInstruction = "CAMPAIGN: TUTORIAL. Clear, step-by-step, and highly informative. Use subtle, elegant arrows, numbered badges, or simple flow indicators. The layout must guide the user's eye logically from one step to the next without feeling cluttered.";
  } else if (campaignType.toLowerCase().includes("landing page")) {
    campaignTypeInstruction = "CAMPAIGN: LANDING PAGE HERO. Massive visual impact, ultra-clean, designed to sit at the very top of a website. The composition must leave ample room for the headline text. The Call to Action (CTA) must be the most prominent and clickable-looking element in the entire image.";
  } else if (campaignType.toLowerCase().includes("customer success")) {
    campaignTypeInstruction = "CAMPAIGN: CUSTOMER SUCCESS. Focus on results, metrics, and human impact. Include subtle elements that suggest growth, trust, and partnership (e.g., upward charts, 5-star motifs).";
  } else if (campaignType.toLowerCase().includes("event invite") || campaignType.toLowerCase().includes("webinar")) {
    campaignTypeInstruction = "CAMPAIGN: EVENT INVITE. Create anticipation and urgency. The design should feel like an exclusive ticket or a live stage preview. Highlight the date/time or 'Join us' vibe.";
  } else if (campaignType.toLowerCase().includes("special offer") || campaignType.toLowerCase().includes("discount")) {
    campaignTypeInstruction = "CAMPAIGN: SPECIAL OFFER. High conversion focus. Use visual cues for value, pricing, or limited-time urgency. Make the offer irresistible without looking cheap.";
  } else if (campaignType.toLowerCase().includes("teaser") || campaignType.toLowerCase().includes("behind the scenes")) {
    campaignTypeInstruction = "CAMPAIGN: TEASER. Mysterious, intriguing, 'coming soon' vibe. Partially obscured UI, dramatic lighting, building hype for an upcoming release.";
  } else {
    campaignTypeInstruction = `Optimize the composition for a ${campaignType}.`;
  }

  let toneInstruction = "";
  if (tone.toLowerCase().includes("professional")) {
    toneInstruction = "TONE: PROFESSIONAL. Corporate, trustworthy, and serious B2B aesthetic. Absolutely no gimmicks, no cartoons, no messy stickers, and no playful 3D emojis. Use straight lines, structured grids, and an authoritative but modern layout.";
  } else if (tone.toLowerCase().includes("playful")) {
    toneInstruction = "TONE: PLAYFUL. Fun, approachable, and friendly. Use rounded, bubbly shapes, warm and inviting colors. You may include a single, tasteful 3D mascot or soft emoji-like element, but DO NOT make it chaotic or cluttered. Keep it organized but lighthearted.";
  } else if (tone.toLowerCase().includes("minimal")) {
    toneInstruction = "TONE: MINIMAL. RUTHLESSLY REDUCTIVE. Strip away absolutely everything that is not essential. Focus purely on typography, massive amounts of negative space, and a single focal point. Zero clutter, zero unnecessary decorative elements.";
  } else if (tone.toLowerCase().includes("premium")) {
    toneInstruction = "TONE: PREMIUM. High-end luxury aesthetic. Sophisticated, expensive-looking, and exclusive. Use elegant, generous spacing, highly refined typography (consider sleek serifs or very clean sans-serifs), and subtle, high-quality textures like frosted glass or brushed dark metal.";
  } else if (tone.toLowerCase().includes("urgent")) {
    toneInstruction = "TONE: URGENT. High energy, compelling, and direct. Use bold colors (like red or orange accents) and dynamic angles to drive immediate action.";
  } else if (tone.toLowerCase().includes("empathetic")) {
    toneInstruction = "TONE: EMPATHETIC. Warm, supportive, and user-centric. Focus on solving pain points. Soft lighting, approachable visuals, and a feeling of relief.";
  } else if (tone.toLowerCase().includes("disruptive")) {
    toneInstruction = "TONE: DISRUPTIVE. Edgy, unconventional, challenging the status quo. Break the grid, use unexpected color combinations, stand out from boring corporate competitors.";
  } else if (tone.toLowerCase().includes("academic")) {
    toneInstruction = "TONE: ACADEMIC. Serious, analytical, and precise. Emphasize charts, data points, and logic. Clean, structured, and highly credible.";
  } else {
    toneInstruction = `Apply a ${tone} tone.`;
  }

  let designStyleInstruction = "";
  if (designStyle.toLowerCase().includes("apple")) {
    designStyleInstruction = "EXTREME APPLE MINIMALISM. Think Apple website. Massive amounts of white/negative space. San Francisco-style typography. Monochromatic or very subtle silver/gray/white tones. NO 3D clutter, NO floating emojis, NO chaotic background elements. A single, perfectly lit, ultra-premium focal point. Less is more. If there is UI, it must be flat, glass-like, and hyper-simplified.";
  } else if (designStyle.toLowerCase().includes("clean")) {
    designStyleInstruction = "Modern B2B SaaS aesthetic. Crisp white backgrounds, subtle drop shadows, rounded corners (border-radius: 12px). High contrast text. Very structured and grid-like. Professional and trustworthy. Zero clutter.";
  } else if (designStyle.toLowerCase().includes("gradient")) {
    designStyleInstruction = "Vibrant Web3/Stripe-inspired startup look. Smooth, glowing mesh gradients in the background. Glassmorphism UI cards floating. Bright, optimistic, and energetic, but keep the layout clean.";
  } else if (designStyle.toLowerCase().includes("dark")) {
    designStyleInstruction = "Premium dark mode aesthetic. Deep charcoal or pure black background (#000000 to #111111). Neon or glowing accent colors. Subtle inner shadows and glowing borders. High-end developer tool vibe.";
  } else if (designStyle.toLowerCase().includes("brutalism")) {
    designStyleInstruction = "NEO-BRUTALISM. Bold, high-contrast, thick black borders, flat vibrant colors (like Figma or Gumroad). Hard shadows, raw typography, unapologetic and trendy.";
  } else if (designStyle.toLowerCase().includes("glassmorphism")) {
    designStyleInstruction = "GLASSMORPHISM. Frosted glass effects, translucent panels, soft multi-colored blurred backgrounds. High-end, futuristic, and elegant UI presentation.";
  } else if (designStyle.toLowerCase().includes("cyberpunk")) {
    designStyleInstruction = "CYBERPUNK. Neon lights, dark gritty background, glowing UI elements, futuristic HUD style, high-tech hacker aesthetic.";
  } else if (designStyle.toLowerCase().includes("organic")) {
    designStyleInstruction = "ORGANIC. Warm earth tones, soft rounded shapes, natural textures, calming and human-centric design. Avoid harsh lines.";
  } else {
    designStyleInstruction = `Apply a ${designStyle} design style.`;
  }

  let modeInstruction = "";
  if (mode.toLowerCase().includes("clean screenshot")) {
    modeInstruction = "MODE: CLEAN SCREENSHOT HIGHLIGHT. ABSOLUTELY NO DEVICE MOCKUPS (no laptops, no phones, no monitors). Show the UI panels directly. The UI must look like a floating, perfectly rendered digital card. Use soft, elegant drop shadows. The background must be a clean, solid color or an extremely subtle, barely noticeable gradient. No real-world environments.";
  } else if (mode.toLowerCase().includes("device mockup")) {
    modeInstruction = "MODE: DEVICE MOCKUP. Place the UI inside a photorealistic, ultra-premium device mockup (e.g., the latest iPhone, iPad, or MacBook Pro). The device should be the absolute hero of the image. Place the device on a clean, minimal, studio-lit surface. Do not clutter the background with random objects.";
  } else if (mode.toLowerCase().includes("feature spotlight")) {
    modeInstruction = "MODE: FEATURE SPOTLIGHT. Macro photography style. Extreme close-up on one specific UI element, button, or graph. Use a strong depth of field (bokeh) effect, heavily blurring out the rest of the interface in the background. Highly detailed, crisp focus on the central feature.";
  } else if (mode.toLowerCase().includes("social media")) {
    modeInstruction = "MODE: SOCIAL MEDIA PROMO. Optimized for Instagram/LinkedIn feeds. Bold, punchy, and highly legible composition. The headline text must be large and instantly readable. Use dynamic angles or perspective to make the UI pop out of the feed. DO NOT make it messy. Keep the sticker/badge usage to an absolute minimum (max 1 or 2).";
  } else if (mode.toLowerCase().includes("ai generated")) {
    modeInstruction = "MODE: AI GENERATED BACKGROUND. Surreal, highly conceptual 3D environment. The UI or product should be seamlessly integrated into a beautiful, abstract 3D world (e.g., floating over a serene, stylized landscape, or surrounded by elegant, floating geometric shapes). The background must complement, not overpower, the UI.";
  } else if (mode.toLowerCase().includes("isometric")) {
    modeInstruction = "MODE: ISOMETRIC 3D. Present the UI or product in a 3D isometric perspective. Floating layers, exploded views, showing depth and architecture of the interface.";
  } else if (mode.toLowerCase().includes("bento")) {
    modeInstruction = "MODE: BENTO BOX. Arrange the features and UI elements in a clean, modern grid layout (like an Apple feature summary). Distinct compartments, highly organized, visually satisfying.";
  } else if (mode.toLowerCase().includes("billboard")) {
    modeInstruction = "MODE: BILLBOARD. Design this as if it's a massive physical billboard in a city. Extremely bold, minimal text, readable from a distance, high impact.";
  } else if (mode.toLowerCase().includes("magazine")) {
    modeInstruction = "MODE: MAGAZINE EDITORIAL. High-fashion or premium editorial layout. Elegant typography, asymmetrical balance, sophisticated and artistic presentation.";
  } else {
    modeInstruction = `Apply a ${mode} presentation mode.`;
  }

  let imageInstructions = "";
  if (previousImage) {
    imageInstructions = `
  MAGIC EDIT INSTRUCTIONS:
  1. You are editing the provided generated image.
  2. Maintain the overall composition, text, and style of the provided image as much as possible.
  3. Apply the user's feedback precisely.`;
  } else if (images.length > 0) {
    imageInstructions = `
  UI ENHANCEMENT & REDRAW INSTRUCTIONS:
  1. Use the provided screenshot(s) ONLY as a loose layout and content reference.
  2. REDRAW and RE-IMAGINE the UI. DO NOT just copy-paste the raw screenshot. Make it look like a Dribbble-quality, ultra-premium SaaS interface.
  3. EXTREME SIMPLIFICATION: The original screenshot has too much text and is too complex. Abstract it heavily. Remove unnecessary details, sidebars, or dense text blocks. Focus ONLY on the core feature. Use simple shapes, icons, or very short, punchy dummy text. Less reading, more visual impact. The UI should look clean and spacious.
  4. LANGUAGE ENFORCEMENT: ALL text visible inside the reimagined UI mockups MUST be in ${outputLanguage}. Translate any English text from the original screenshot into ${outputLanguage}.
  5. The primary goal is to drive clicks to the CTA button. Make the CTA prominent.
  6. MAKE IT PUNCHY: The overall visual should be striking and immediately understandable. Don't clutter the canvas. Focus on a single strong message and a beautiful, simplified UI representation.`;
  } else {
    imageInstructions = `
  VISUAL CREATION INSTRUCTIONS (NO SCREENSHOT PROVIDED):
  1. Since no screenshot is provided, you MUST CREATE a stunning, conceptual visual representation of the product and feature from scratch.
  2. Use beautiful, modern abstract shapes, 3D elements, or custom high-quality icons that perfectly represent the feature: "${featureName}".
  3. Create a clean, minimal, and highly engaging composition. It must be a "scroll-stopper" that immediately grabs attention.
  4. Use soft, premium backgrounds (e.g., smooth, subtle gradients that match the brand color or clean light/dark themes).
  5. Do NOT clutter the visual. Keep it extremely spacious, elegant, and focused on the core message.
  6. LANGUAGE ENFORCEMENT: ALL text visible inside the visual MUST be in ${outputLanguage}.
  7. The primary goal is to drive clicks to the CTA button. Make the CTA prominent.`;
  }

  let referenceInstruction = "";
  if (referenceImage) {
    referenceInstruction = `\n\nSTYLE REFERENCE IMAGE PROVIDED:\nThe user has uploaded a specific image to serve as a stylistic and layout reference. You MUST heavily analyze this reference image and mimic its overall aesthetic, layout structure, typography placement, color balance, and visual vibe. Do not copy the exact text or product from the reference, but DO copy the *feel* and *composition*.`;
  }

  let basePrompt = previousImage 
    ? `Edit the provided image based on the user's feedback.`
    : `Create a highly polished, conversion-focused marketing visual for a SaaS product.`;

  return `${basePrompt}
  
  Product Name: ${productName || 'Software'}
  Feature: ${featureName || 'New Feature'}
  Description: ${description || 'Modern software application'}
  Brand Color: ${brandColor}
  Language for ALL text (including UI elements): ${outputLanguage}
  Campaign Focus / Theme: ${campaignFocus || 'General product promotion'}
  Custom Instructions: ${customInstruction || 'None'}
  
  MANDATORY TEXT TO INCLUDE IN THE IMAGE:
  Headline: "${headline || '[Auto-generated headline]'}"
  Subheadline: "${subheadline || '[Auto-generated subheadline]'}"
  Call to Action (CTA) Button: "${cta || '[Auto-generated CTA]'}"
  
  CRITICAL RULES FOR THIS GENERATION:
  1. CAMPAIGN TYPE (${campaignType}): ${campaignTypeInstruction}
  2. TONE (${tone}): ${toneInstruction}
  3. DESIGN STYLE (${designStyle}): ${designStyleInstruction}
  4. MODE (${mode}): ${modeInstruction}
  
  - OVERRIDING RULE: DO NOT CLUTTER THE IMAGE. The user specifically complained about generated images being too complex, messy, and having too many random icons/stickers. You MUST adhere strictly to the minimalism requested. Less is more.
  
  ${imageInstructions}
  ${referenceInstruction}
  
  7. Specific Style for this variation: ${stylePrompt}
  8. Typography: Select a maximum of 2 highly compatible fonts that perfectly match the requested Design Style, Mode, and Tone. Ensure the text is highly legible and creates a strong visual hierarchy.${feedbackInstruction}`;
};

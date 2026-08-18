// ============================================
// DOM ELEMENTS
// ============================================
const avatarPlayer = document.getElementById('avatarPlayer');
const avatarWrapper = document.querySelector('.avatar-wrapper');
const avatarBubble = document.getElementById('avatarBubble');
const bubbleText = document.getElementById('bubbleText');
const moodFill = document.getElementById('moodFill');
const moodEmoji = document.getElementById('moodEmoji');
const chatContainer = document.getElementById('chatContainer');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const micButton = document.getElementById('micButton');
const typingIndicator = document.getElementById('typingIndicator');

// ============================================
// AVATAR ANIMATION STATES
// ============================================
// Use different Lottie animations for different states
// Browse free ones at: https://lottiefiles.com/free-animations/chatbot
const AVATAR_STATES = {
  idle:    'https://lottie.host/4db68bbd-31f6-4cd8-84eb-189de081159a/IGmMCqhzpt.lottie',
  happy:   'https://assets2.lottiefiles.com/packages/lf20_joy2jw0e.json',
  talking: 'https://assets5.lottiefiles.com/packages/lf20_M9p23l.json',
  waving:  'https://assets3.lottiefiles.com/packages/lf20_puciaact.json',
  sad:     'https://assets9.lottiefiles.com/packages/lf20_qp1q7mct.json',
};

let currentMood = 70; // 0-100 scale

function setAvatarState(state) {
  if (AVATAR_STATES[state]) {
    avatarPlayer.load(AVATAR_STATES[state]);
  }
}

function showBubble(text, duration = 3000) {
  bubbleText.textContent = text;
  avatarBubble.classList.add('visible');
  setTimeout(() => avatarBubble.classList.remove('visible'), duration);
}

function triggerAvatarTalking(isTalking) {
  if (isTalking) {
    avatarWrapper.classList.add('talking');
  } else {
    avatarWrapper.classList.remove('talking');
  }
}

function triggerAvatarReaction() {
  avatarWrapper.classList.add('reacting');
  setTimeout(() => avatarWrapper.classList.remove('reacting'), 600);
}

// ============================================
// MOOD TRACKING (sent to 3rd agent)
// ============================================
function updateMood(sentiment) {
  // sentiment: -1 (very negative) to +1 (very positive)
  currentMood = Math.max(0, Math.min(100, currentMood + sentiment * 20));
  moodFill.style.width = `${currentMood}%`;
  
  if (currentMood > 70) {
    moodFill.style.background = '#10B981';
    moodEmoji.textContent = '😊';
  } else if (currentMood > 40) {
    moodFill.style.background = '#F59E0B';
    moodEmoji.textContent = '😐';
  } else {
    moodFill.style.background = '#EF4444';
    moodEmoji.textContent = '😔';
  }
  
  // Send mood data to the 3rd agent (bridge between child & parent)
  sendMoodUpdate(currentMood);
}

async function sendMoodUpdate(mood) {
  try {
    await fetch('/api/bridge-agent/mood', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        child_mood: mood,
        timestamp: new Date().toISOString()
      })
    });
  } catch (err) {
    console.error('Failed to update mood:', err);
  }
}

// ============================================
// SPEECH-TO-TEXT (Browser API)
// ============================================
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isListening = false;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.interimResults = true;
  recognition.continuous = false;

  recognition.onresult = (event) => {
    const transcript = event.results[event.results.length - 1][0].transcript;
    messageInput.value = transcript;
    
    if (event.results[event.results.length - 1].isFinal) {
      handleSendMessage(transcript);
    }
  };

  recognition.onend = () => {
    isListening = false;
    micButton.classList.remove('listening');
  };

  recognition.onerror = (event) => {
    console.error('Speech error:', event.error);
    isListening = false;
    micButton.classList.remove('listening');
  };
}

micButton.addEventListener('click', () => {
  if (!recognition) {
    alert('Voice input not supported in this browser. Try Chrome!');
    return;
  }
  
  if (!isListening) {
    recognition.start();
    isListening = true;
    micButton.classList.add('listening');
    showBubble("I'm listening... 🎧");
  } else {
    recognition.stop();
    isListening = false;
    micButton.classList.remove('listening');
  }
});

// ============================================
// TEXT-TO-SPEECH (Agent speaks back)
// ============================================
function speakResponse(text) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.9;
  utterance.pitch = 1.15;
  
  const voices = speechSynthesis.getVoices();
  const friendlyVoice = voices.find(v => 
    v.name.includes('Google') && v.name.includes('Female')
  ) || voices.find(v => v.lang === 'en-US') || voices[0];
  
  if (friendlyVoice) utterance.voice = friendlyVoice;
  
  utterance.onstart = () => triggerAvatarTalking(true);
  utterance.onend = () => {
    triggerAvatarTalking(false);
    setAvatarState('idle');
  };
  
  speechSynthesis.speak(utterance);
}

// ============================================
// CHAT FUNCTIONALITY
// ============================================
function addMessage(content, isUser = false) {
  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${isUser ? 'user' : 'agent'}`;
  msgDiv.innerHTML = `<div class="message-bubble">${content}</div>`;
  chatContainer.appendChild(msgDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

async function handleSendMessage(text) {
  const message = text || messageInput.value.trim();
  if (!message) return;
  
  // Add user message to chat
  addMessage(message, true);
  messageInput.value = '';
  
  // Avatar reacts to child's message
  triggerAvatarReaction();
  showBubble("Hmm, let me think... 🤔", 2000);
  
  // Show typing indicator
  typingIndicator.classList.add('active');
  
  try {
    // Send to YOUR child agent chatbot backend
    const response = await fetch('/api/child-agent/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    
    const data = await response.json();
    
    typingIndicator.classList.remove('active');
    
    // Display agent reply
    addMessage(data.reply, false);
    
    // Avatar shows happy state and speaks
    setAvatarState('happy');
    showBubble(data.reply.substring(0, 60) + '...', 4000);
    speakResponse(data.reply);
    
    // Update mood based on sentiment from agent
    if (data.sentiment !== undefined) {
      updateMood(data.sentiment);
    }
    
  } catch (error) {
    typingIndicator.classList.remove('active');
    addMessage("Oops! I had a little hiccup. Try again? 😅", false);
  }
}

sendButton.addEventListener('click', () => handleSendMessage());
messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') handleSendMessage();
});

// ============================================
// INITIAL GREETING
// ============================================
window.addEventListener('load', () => {
  // Ensure voices are loaded
  speechSynthesis.getVoices();
  
  setTimeout(() => {
    setAvatarState('waving');
    showBubble("Hey there! I'm Buddy 💛", 4000);
    addMessage("Hey! 👋 I'm Buddy, your safe space to talk. Whatever you're feeling, I'm here to listen. No judgement, ever. 💛");
    
    setTimeout(() => {
      speakResponse("Hey! I'm Buddy, your safe space to talk. Whatever you're feeling, I'm here to listen.");
    }, 1000);
  }, 500);
});
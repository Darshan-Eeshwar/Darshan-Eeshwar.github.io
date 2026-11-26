(() => {
  'use strict';
  if (document.querySelector('.business-chat')) return;
  const script = document.currentScript;
  const endpoint = script.dataset.endpoint || '';
  const root = document.createElement('div');
  root.className = 'business-chat';
  root.innerHTML = `
    <button class="business-chat__launcher" type="button" aria-expanded="false" aria-controls="business-chat-panel">
      <span aria-hidden="true">✦</span> Ask Dimple <span class="business-chat__launcher-arrow" aria-hidden="true">↗</span>
    </button>
    <section class="business-chat__panel" id="business-chat-panel" aria-labelledby="business-chat-title" hidden>
      <div class="business-chat__header">
        <div class="business-chat__avatar" aria-hidden="true">DE</div>
        <div><h2 id="business-chat-title">Dimple Assistant</h2><p class="business-chat__mode"></p></div>
        <button class="business-chat__close" type="button" aria-label="Close chat">×</button>
      </div>
      <div class="business-chat__messages" role="log" aria-label="Chat messages" aria-live="polite" aria-relevant="additions text" tabindex="0"></div>
      <div class="business-chat__suggestions" aria-label="Suggested questions">
        <button type="button">Website pricing</button><button type="button">Services</button><button type="button">Project timeline</button><button type="button" lang="ta">தமிழ் உதவி</button>
      </div>
      <p class="business-chat__notice"></p>
      <form class="business-chat__form">
        <label class="business-chat__sr" for="business-chat-message">Your message</label>
        <input id="business-chat-message" name="message" type="text" maxlength="1000" placeholder="Ask about your project…" autocomplete="off" required>
        <button type="submit" aria-label="Send message">↑</button>
      </form>
      <div class="business-chat__footer"><a class="business-chat__handoff" target="_blank" rel="noopener">Talk on WhatsApp ↗</a><button class="business-chat__reset" type="button">New chat</button></div>
    </section>`;
  document.body.append(root);
  // Retain the original WhatsApp link when scripts are disabled or fail to load.
  document.querySelectorAll('a.float').forEach(link => { link.hidden = true; });
  const panel = root.querySelector('section');
  const launcher = root.querySelector('.business-chat__launcher');
  const messages = root.querySelector('[role="log"]');
  const input = root.querySelector('input');
  const form = root.querySelector('form');
  const send = form.querySelector('button');
  const mode = root.querySelector('.business-chat__mode');
  const notice = root.querySelector('.business-chat__notice');
  const handoff = root.querySelector('.business-chat__handoff');
  const greeting = 'Hi! I’m Dimple Assistant. What are you planning for your business? I can help with websites, services, pricing and the next steps.';
  let history = [];
  let controller;
  let generation = 0;
  let busy = false;

  function showMode(ai) {
    mode.textContent = ai ? 'AI assistance' : 'Website guide';
    notice.textContent = ai ? 'Messages are sent to our AI provider. Please avoid sensitive information. Confirm quotes with our team.' : 'Answers use our published website information. For a tailored answer, chat with our team.';
  }

  function addMessage(role, text) {
    const bubble = document.createElement('div');
    bubble.className = `business-chat__message business-chat__message--${role}`;
    const label = document.createElement('span');
    label.className = 'business-chat__sr';
    label.textContent = role === 'user' ? 'You: ' : 'Dimple Assistant: ';
    bubble.append(label, document.createTextNode(text));
    messages.append(bubble);
    messages.scrollTop = messages.scrollHeight;
  }

  function updateHandoff() {
    const lastQuestion = history.filter(item => item.role === 'user').at(-1);
    const text = 'Hello Dimple Enterprises, I would like help with my project.' + (lastQuestion ? '\nMy question: ' + lastQuestion.content : '');
    handoff.href = 'https://wa.me/918668098213?text=' + encodeURIComponent(text);
  }

  function guideReply(question) {
    const text = question.toLowerCase();
    if (/[\u0B80-\u0BFF]/.test(text)) return 'வணக்கம்! இணையதள உருவாக்கம், உள்ளூர் SEO மற்றும் டிஜிட்டல் மார்க்கெட்டிங் சேவைகளை வழங்குகிறோம். தொடக்க இணையதளத்தின் விலை ₹15,000 முதல். தேவைகளை ஆய்வு செய்த பிறகு இறுதி விலை உறுதி செய்யப்படும். உங்கள் வணிகத் தேவையை WhatsApp-ல் எங்களுடன் பகிருங்கள்.';
    if (/\b(price|pricing|cost|budget|package|rate|quote|much)\b/.test(text)) return 'Our Starter presence package starts at ₹15,000, and Business growth starts at ₹30,000. Commerce solutions have a custom quote. These are indicative starting prices. Share your pages, features and timeline with our team for a confirmed quote.';
    if (/\b(time|timeline|long|weeks?|days?|delivery|launch)\b/.test(text)) return 'A typical small-business website takes about 2–4 weeks after content and approvals are available. Your features, content readiness and review time affect the schedule. Our team can confirm a timeline for your project.';
    if (/\b(seo|google|ranking|search)\b/.test(text)) return 'We offer local SEO foundations, search-friendly content and Google Business Profile guidance for Vellore businesses. Tell our team your business type and target locations to discuss a plan.';
    if (/\b(shop|store|commerce|payment|products?)\b/.test(text)) return 'Our commerce solution can include a product catalogue, payment integration guidance and order or enquiry workflows. Pricing depends on the requirements. Tell us your product count and how you want customers to order.';
    if (/\b(maintenance|support|updates?)\b/.test(text)) return 'Post-launch maintenance can cover content changes, performance checks and technical improvements. Share your existing website and the help you need with our team.';
    if (/\b(service|services|offer|design|marketing|automation|website)\b/.test(text)) return 'We help with business websites, e-commerce, local SEO, digital marketing, maintenance and business automation. Which service would you like to discuss? You can also use Get a quote in the website menu.';
    if (/\b(contact|phone|call|email|human|person|team|address|location|hours)\b/.test(text)) return 'We serve Vellore, Tamil Nadu and remote projects across India. Call +91 86680 98213 or email starwaltcompany@gmail.com. Business hours are Monday–Saturday, 9 AM–7 PM IST. The WhatsApp button below opens a chat with our team.';
    if (/^(hi|hello|hey|thanks|thank you)[! .]*$/.test(text)) return 'Hello! How can I help with your business website? Ask about pricing, services or project timelines.';
    return 'I can help with the services, starting prices and timelines published on this website. For your specific question, use Talk on WhatsApp below. Your latest question will be included so our team has the context.';
  }

  function setBusy(value) {
    busy = value;
    send.disabled = value;
    root.querySelectorAll('.business-chat__suggestions button').forEach(button => { button.disabled = value; });
    form.setAttribute('aria-busy', String(value));
  }

  async function ask(question) {
    if (busy || !question.trim()) return;
    const text = question.trim().slice(0, 1000);
    history.push({ role: 'user', content: text });
    history = history.slice(-11);
    while (JSON.stringify(history).length > 18000 && history.length > 1) history = history.slice(2);
    addMessage('user', text);
    input.value = '';
    updateHandoff();
    if (!endpoint) {
      const reply = guideReply(text);
      history.push({ role: 'assistant', content: reply });
      addMessage('assistant', reply);
      return;
    }
    const requestGeneration = generation;
    const requestController = new AbortController();
    controller = requestController;
    const timer = setTimeout(() => requestController.abort(), 20000);
    setBusy(true);
    mode.textContent = 'Preparing your reply…';
    try {
      const response = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }), signal: requestController.signal,
        credentials: 'omit', cache: 'no-store'
      });
      if (!response.ok) throw new Error('Assistant unavailable');
      const data = await response.json();
      if (typeof data.reply !== 'string' || !data.reply.trim() || data.reply.length > 6000) throw new Error('Invalid assistant response');
      if (requestGeneration !== generation) return;
      showMode(true);
      history.push({ role: 'assistant', content: data.reply });
      addMessage('assistant', data.reply);
    } catch {
      if (requestGeneration !== generation) return;
      showMode(false);
      addMessage('assistant', 'AI assistance is unavailable right now. Here is our website information.\n\n' + guideReply(text));
      // Reset remote context after a failed turn so messages still alternate.
      history = [];
    } finally {
      clearTimeout(timer);
      if (requestGeneration === generation) { setBusy(false); controller = undefined; }
    }
  }

  function toggle(open) {
    panel.hidden = !open;
    launcher.setAttribute('aria-expanded', String(open));
    root.classList.toggle('business-chat--open', open);
    if (open) input.focus();
    else launcher.focus();
  }

  launcher.addEventListener('click', () => toggle(panel.hidden));
  root.querySelector('.business-chat__close').addEventListener('click', () => toggle(false));
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) { toggle(false); event.stopPropagation(); }
  });
  form.addEventListener('submit', event => { event.preventDefault(); ask(input.value); });
  root.querySelector('.business-chat__suggestions').addEventListener('click', event => {
    const button = event.target.closest('button');
    if (button) ask(button.textContent);
  });
  root.querySelector('.business-chat__reset').addEventListener('click', () => {
    generation += 1;
    controller?.abort();
    controller = undefined;
    history = [];
    messages.replaceChildren();
    setBusy(false);
    showMode(Boolean(endpoint));
    addMessage('assistant', greeting);
    updateHandoff();
    input.focus();
  });
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) { event.preventDefault(); toggle(false); }
  });
  showMode(Boolean(endpoint));
  addMessage('assistant', greeting);
  updateHandoff();
})();

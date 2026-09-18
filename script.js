const menuToggle = document.querySelector(".menu-toggle");
const mobileMenu = document.querySelector("#mobile-menu");

if (menuToggle && mobileMenu) {
  menuToggle.addEventListener("click", () => {
    const open = mobileMenu.classList.toggle("open");
    menuToggle.setAttribute("aria-expanded", String(open));
    menuToggle.textContent = open ? "Close" : "Menu";
  });
  mobileMenu.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
    mobileMenu.classList.remove("open");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.textContent = "Menu";
  }));
}

const revealItems = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries, currentObserver) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        currentObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  revealItems.forEach((item) => observer.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("visible"));
}

const contactForm = document.querySelector("#contact-form");
if (contactForm) {
  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = contactForm.querySelector(".form-status");
    const button = contactForm.querySelector("button");
    button.disabled = true;
    status.textContent = "Sending...";
    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(contactForm)))
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to send");
      contactForm.reset();
      status.textContent = "Thanks — your message was saved.";
    } catch (error) {
      status.textContent = "This message could not be saved yet. Please try again.";
    } finally {
      button.disabled = false;
    }
  });
}

const messageList = document.querySelector("#message-list");
if (messageList) {
  fetch("/api/messages").then((response) => response.json()).then((messages) => {
    document.querySelector("#message-count").textContent = messages.length;
    if (!messages.length) {
      messageList.innerHTML = '<p class="empty-state">No messages yet. They will appear here after someone uses the contact form.</p>';
      return;
    }
    messageList.innerHTML = messages.map((message) => `
      <article class="message">
        <div><strong>${escapeHtml(message.name)}</strong><small>${escapeHtml(message.email)}</small></div>
        <p><strong>${escapeHtml(message.subject || "No subject")}</strong>${escapeHtml(message.message)}</p>
        <small>${new Date(message.createdAt).toLocaleDateString()}</small>
      </article>`).join("");
  }).catch(() => {
    messageList.innerHTML = '<p class="empty-state">Messages are unavailable right now.</p>';
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[character]));
}
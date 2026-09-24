const loginForm = document.querySelector("#admin-login-form");

if (loginForm) {
  const status = document.querySelector("#admin-login-status");
  const submitButton = loginForm.querySelector('button[type="submit"]');

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    submitButton.disabled = true;
    status.textContent = "Checking password…";

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: new FormData(loginForm).get("password") })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to sign in.");
      window.location.replace("/admin.html");
    } catch (error) {
      status.textContent = error.message || "Unable to sign in. Please try again.";
      submitButton.disabled = false;
    }
  });
}
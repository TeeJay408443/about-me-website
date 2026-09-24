const logoutButton = document.querySelector("#admin-logout");

if (logoutButton) {
  logoutButton.addEventListener("click", async () => {
    logoutButton.disabled = true;
    try {
      const response = await fetch("/api/admin/logout", { method: "POST" });
      if (!response.ok) throw new Error("Unable to log out.");
      window.location.replace("/admin-login.html");
    } catch {
      logoutButton.disabled = false;
    }
  });
}
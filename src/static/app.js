document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const signupContainer = document.getElementById("signup-container");
  const messageDiv = document.getElementById("message");
  const accountButton = document.getElementById("account-button");
  const accountLabel = document.getElementById("account-label");
  const accountDialog = document.getElementById("account-dialog");
  const closeDialogButton = document.getElementById("close-dialog");
  const loginForm = document.getElementById("login-form");
  const loginView = document.getElementById("login-view");
  const teacherView = document.getElementById("teacher-view");
  const teacherName = document.getElementById("teacher-name");
  const loginError = document.getElementById("login-error");
  const logoutButton = document.getElementById("logout-button");
  const sessionKey = "mergingtonTeacherSession";
  let currentTeacher = null;

  function getToken() {
    return localStorage.getItem(sessionKey);
  }

  function authHeaders() {
    return { Authorization: `Bearer ${getToken()}` };
  }

  function setAuthState(username) {
    currentTeacher = username;
    const isAuthenticated = Boolean(username);
    signupContainer.classList.toggle("hidden", !isAuthenticated);
    loginView.classList.toggle("hidden", isAuthenticated);
    teacherView.classList.toggle("hidden", !isAuthenticated);
    accountLabel.textContent = isAuthenticated ? username : "Teacher sign in";
    teacherName.textContent = username || "";
  }

  function clearSession() {
    localStorage.removeItem(sessionKey);
    setAuthState(null);
  }

  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");
    setTimeout(() => messageDiv.classList.add("hidden"), 5000);
  }

  async function restoreSession() {
    const token = getToken();
    if (!token) {
      setAuthState(null);
      return;
    }

    try {
      const response = await fetch("/auth/me", { headers: authHeaders() });
      if (!response.ok) {
        clearSession();
        return;
      }
      const teacher = await response.json();
      setAuthState(teacher.username);
    } catch (error) {
      clearSession();
      console.error("Error restoring teacher session:", error);
    }
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Only authenticated teachers receive participant removal controls.
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span>${
                        currentTeacher
                          ? `<button class="delete-btn" type="button" data-activity="${name}" data-email="${email}" aria-label="Unregister ${email}">&times;</button>`
                          : ""
                      }</li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: authHeaders(),
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        fetchActivities();
      } else {
        if (response.status === 401) {
          clearSession();
        }
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: authHeaders(),
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        signupForm.reset();
        fetchActivities();
      } else {
        if (response.status === 401) {
          clearSession();
        }
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  accountButton.addEventListener("click", () => {
    loginError.classList.add("hidden");
    accountDialog.showModal();
  });

  closeDialogButton.addEventListener("click", () => accountDialog.close());

  accountDialog.addEventListener("click", (event) => {
    if (event.target === accountDialog) {
      accountDialog.close();
    }
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    loginError.classList.add("hidden");

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: document.getElementById("username").value,
          password: document.getElementById("password").value,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        loginError.textContent = result.detail || "Unable to sign in";
        loginError.classList.remove("hidden");
        return;
      }

      localStorage.setItem(sessionKey, result.token);
      setAuthState(result.username);
      loginForm.reset();
      accountDialog.close();
      await fetchActivities();
      showMessage("Teacher mode enabled", "success");
    } catch (error) {
      loginError.textContent = "Unable to reach the server";
      loginError.classList.remove("hidden");
      console.error("Error signing in:", error);
    }
  });

  logoutButton.addEventListener("click", async () => {
    try {
      await fetch("/auth/logout", { method: "POST", headers: authHeaders() });
    } finally {
      clearSession();
      accountDialog.close();
      await fetchActivities();
      showMessage("Signed out", "success");
    }
  });

  // Initialize app
  restoreSession().then(fetchActivities);
});

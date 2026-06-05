interface AdminNotification {
  id: number;
  message: string;
  type: "leave" | "attendance" | "system";
  createdAt: string;
}

class AdminNotifications {
  private readonly bell = document.getElementById("notificationButton");
  private readonly badge = document.getElementById("leaveCountBadge");

  public init(): void {
    if (!this.bell) return;
    this.bell.addEventListener("click", () => this.showNotifications());
    void this.pollNotifications();
  }

  private async pollNotifications(): Promise<void> {
    // Simple polling for now
    try {
      const response = await fetch("/api/dashboard", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (!response.ok) return;
      const data = await response.json();
      if (this.badge && data.stats) {
        const count = data.stats.pendingLeaveRequests || 0;
        this.badge.textContent = String(count);
        this.badge.style.display = count > 0 ? "grid" : "none";
      }
    } catch {
      // Ignore
    } finally {
      setTimeout(() => void this.pollNotifications(), 60000);
    }
  }

  private showNotifications(): void {
    // In a real app, this would show a dropdown
    console.log("Showing notifications...");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new AdminNotifications().init();
});

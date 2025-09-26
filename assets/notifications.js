function initNotifications() {
  const notificationButton = document.getElementById('notificationButton');
  const notificationDropdown = document.getElementById('notificationDropdown');
  const notificationDot = document.getElementById('notificationDot');
  const markAllReadBtn = document.getElementById('markAllReadBtn');
  const notificationList = document.getElementById('notificationList');

  if (!notificationButton || !notificationDropdown) return;

  // Toggle notification dropdown
  notificationButton.addEventListener('click', function(e) {
    e.stopPropagation();
    notificationDropdown.classList.toggle('hidden');
  });

  // Mark all notifications as read
  if (markAllReadBtn) {
    markAllReadBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      
      if (notificationList) {
        const unreadItems = notificationList.querySelectorAll('.notification-item[data-read="false"]');
        unreadItems.forEach(function(item) {
          item.dataset.read = 'true';
          
          // Update visual state
          const dot = item.querySelector('.w-2.h-2');
          if (dot) {
            dot.classList.remove('bg-blue-500', 'bg-green-500');
            dot.classList.add('bg-gray-300');
          }
          
          const title = item.querySelector('.text-sm.font-medium');
          if (title) {
            title.classList.remove('text-gray-900');
            title.classList.add('text-gray-700');
          }
        });
      }
      
      updateNotificationDot();
      
      if (typeof showToast === 'function') {
        showToast('All notifications marked as read');
      }
    });
  }

  // Mark individual notification as read when clicked
  if (notificationList) {
    notificationList.addEventListener('click', function(e) {
      const notificationItem = e.target.closest('.notification-item');
      if (notificationItem && notificationItem.dataset.read === 'false') {
        notificationItem.dataset.read = 'true';
        
        // Update visual state
        const dot = notificationItem.querySelector('.w-2.h-2');
        if (dot) {
          dot.classList.remove('bg-blue-500', 'bg-green-500');
          dot.classList.add('bg-gray-300');
        }
        
        const title = notificationItem.querySelector('.text-sm.font-medium');
        if (title) {
          title.classList.remove('text-gray-900');
          title.classList.add('text-gray-700');
        }
        
        updateNotificationDot();
      }
    });
  }

  // Update notification dot visibility
  function updateNotificationDot() {
    if (!notificationDot || !notificationList) return;
    
    const unreadCount = notificationList.querySelectorAll('.notification-item[data-read="false"]').length;
    
    if (unreadCount > 0) {
      notificationDot.classList.remove('hidden');
    } else {
      notificationDot.classList.add('hidden');
    }
  }

  // **ADD THIS: Close notification dropdown when clicking outside**
  document.addEventListener('click', function(e) {
    if (!notificationButton.contains(e.target) && !notificationDropdown.contains(e.target)) {
      notificationDropdown.classList.add('hidden');
    }
  });

  // **ADD THIS: Close on Escape key**
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && !notificationDropdown.classList.contains('hidden')) {
      notificationDropdown.classList.add('hidden');
    }
  });

  // Initialize notification dot state
  updateNotificationDot();
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initNotifications);
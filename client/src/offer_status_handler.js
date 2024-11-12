// offer-status-handler.js
window.getStatusColor = function(status) {
    const statusObj = window.offerStatuses.find(s => s.status === status);
    // Return the matching color or a default gray if status not found
    return statusObj ? statusObj.color : 'bg-gray-400 hover:bg-gray-500';
};

// Make the functions global by attaching to window
window.offerStatuses = [
    { status: 'in_review', color: 'bg-yellow-500 hover:bg-yellow-600' },
    { status: 'rejected', color: 'bg-red-500 hover:bg-red-600' },
    { status: 'shortlisted', color: 'bg-green-500 hover:bg-green-600' },
    { status: 'round 2', color: 'bg-blue-500 hover:bg-blue-600' },
    { status: 'round 3', color: 'bg-purple-500 hover:bg-purple-600' }
];

window.showOfferStatusPopup = function(appId, currentStatus) {
    const popupContent = `
        <div class="bg-gray-50 p-4 rounded-lg shadow-lg" style="min-width: 200px; max-width: 300px;">
            <h3 class="text-lg font-semibold mb-3">Update Offer Status</h3>
            <div class="grid gap-2">
                ${window.offerStatuses.map(({ status, color }) => `
                    <button 
                        onclick="window.updateOfferStatus(${appId}, '${status}')"
                        class="${color} text-white px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                            currentStatus === status ? 'ring-2 ring-offset-2 ring-black' : ''
                        }">
                        ${status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                    </button>
                `).join('')}
            </div>
        </div>
    `;

    Swal.fire({
        html: popupContent,
        showConfirmButton: false,
        showCloseButton: true,
        customClass: {
            popup: 'swal2-popup-custom',
        }
    });
};

window.updateOfferStatus = async function(appId, newStatus) {
    try {
        const response = await axios.put('/update-offer-status', {
            appId: appId,
            offerStatus: newStatus
        });

        if (response.data.success) {
            // Close the popup
            Swal.fire({
                icon: 'success',
                title: 'Status Updated',
                text: 'Offer status has been updated successfully',
                timer: 1500,
                showConfirmButton: false
            }).then(() => {
                // Refresh the dashboard data
                const urlParams = new URLSearchParams(window.location.search);
                const srn = urlParams.get('srn');
                fetchDashboardData(srn);
            });
        }
    } catch (error) {
        console.error('Error updating offer status:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Failed to update offer status. Please try again.',
        });
    }
};

// Add custom styles for the popup
const style = document.createElement('style');
style.textContent = `
    .swal2-popup-custom {
        padding: 1rem;
        width: auto !important;
    }
`;
document.head.appendChild(style);
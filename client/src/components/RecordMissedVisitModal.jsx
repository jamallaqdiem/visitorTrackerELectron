

/**
 * Modal for staff to input a historical entry time for a missed visitor.
 * This will trigger the backend correction process.
 * * @param {object} props - Component props.
 * @param {boolean} props.showModal - Controls visibility.
 * @param {function} props.setShowModal - Function to close the modal.
 * @param {string} props.entryTime - Current value of the datetime-local input.
 * @param {function} props.setEntryTime - Function to update the datetime input state.
 * @param {function} props.confirmAction - The function to call the backend API.
 */
const RecordMissedVisitModal = ({ 
    showModal, 
    setShowModal, 
    entryTime, 
    setEntryTime, 
    confirmAction 
}) => {
    if (!showModal) return null;

    // Handler for the main action
    const handleConfirm = () => {
        if (!entryTime) {
            alert("Please provide the estimated Entry Time before confirming.");
            return;
        }
        confirmAction();
    };

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 transform transition-all">
                <h2 className="text-2xl font-bold text-yellow-600 mb-4 border-b pb-2">
                    Correcting Missed Entry Time
                </h2>
                

                <div className="mb-6">
                    <label htmlFor="missedEntryTime" className="block text-sm font-medium text-gray-700 mb-2">
                        Estimated Entry Time
                    </label>
                    {/* The datetime-local input is crucial for capturing both date and time */}
                    <input
                        type="datetime-local"
                        id="missedEntryTime"
                        value={entryTime}
                        onChange={(e) => setEntryTime(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-yellow-500 focus:border-yellow-500 transition duration-150"
                        required
                    />
                </div>

                <div className="flex justify-end space-x-3">
                    <button
                        onClick={() => setShowModal(false)}
                        className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        className="px-4 py-2 bg-yellow-600 text-white rounded-lg font-semibold shadow-md hover:bg-yellow-700 transition-colors flex items-center"
                    >
                        Confirm Correction
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RecordMissedVisitModal;

import { useState } from "react";

const Tooltip = ({ text, children }) => {
  const [show, setShow] = useState(false);

  return (
    <div className="relative inline-flex items-center group">
      {/* The Actual Content (Label/Button/Icon) */}
      {children}

      {/* The Help Trigger Icon (?) */}
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(!show)} // For touch screens
        className="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-black bg-gray-100 rounded-full border border-gray-300 hover:bg-blue-100 hover:text-blue-600 transition-colors cursor-help"
      >
        ?
      </button>

      {/* The Tooltip Bubble */}
      {show && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-gray-800 text-white text-sm rounded-lg shadow-xl z-50 pointer-events-none animate-in fade-in zoom-in duration-200">
          {text}
          {/* Triangle Pointer */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-gray-800"></div>
        </div>
      )}
    </div>
  );
};

export default Tooltip;

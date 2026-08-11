import React, { useState, useRef, useEffect } from 'react';

export default function WorkerMultiSelect({
    label,
    workers = [],
    selectedWorkerIds = [],
    onChange,
    disabled = false,
    placeholder = "Select team members...",
    isLoading = false
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const containerRef = useRef(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedWorkers = workers.filter(w => selectedWorkerIds.includes(w._id?.toString() || w._id));

    const filteredWorkers = workers.filter(w => {
        const query = searchQuery.toLowerCase();
        const nameMatch = w.name?.toLowerCase().includes(query);
        const emailMatch = w.email?.toLowerCase().includes(query);
        const phoneMatch = w.phone?.toLowerCase().includes(query);
        return nameMatch || emailMatch || phoneMatch;
    });

    const toggleWorker = (workerId) => {
        const idStr = workerId.toString();
        if (selectedWorkerIds.includes(idStr)) {
            onChange(selectedWorkerIds.filter(id => id !== idStr));
        } else {
            onChange([...selectedWorkerIds, idStr]);
        }
    };

    const removeWorker = (workerId, e) => {
        e.stopPropagation();
        const idStr = workerId.toString();
        onChange(selectedWorkerIds.filter(id => id !== idStr));
    };

    return (
        <div className="relative w-full" ref={containerRef}>
            {label && (
                <label className="block text-xs font-bold uppercase tracking-wider mb-1 text-[#111827]">
                    {label}
                </label>
            )}

            <div
                onClick={() => !disabled && !isLoading && setIsOpen(!isOpen)}
                className={`w-full min-h-[42px] bg-white border border-[#FEF3C7] rounded-xl px-3 py-2 text-sm flex flex-wrap items-center gap-1.5 cursor-pointer transition-all duration-200 ${
                    disabled || isLoading ? 'bg-gray-100 cursor-not-allowed opacity-75' : 'hover:border-[#F97316] focus-within:ring-2 focus-within:ring-[#F97316]'
                }`}
            >
                {isLoading ? (
                    <span className="text-xs text-[#9CA3AF] italic">Loading workers...</span>
                ) : selectedWorkers.length === 0 ? (
                    <span className="text-xs text-[#9CA3AF]">{placeholder}</span>
                ) : (
                    selectedWorkers.map(w => (
                        <span
                            key={w._id}
                            className="inline-flex items-center gap-1 bg-[#FEF3C7] text-[#9A3412] px-2.5 py-0.5 rounded-full text-xs font-bold"
                        >
                            {w.name}
                            {!disabled && (
                                <button
                                    type="button"
                                    onClick={(e) => removeWorker(w._id, e)}
                                    className="hover:text-red-600 font-extrabold cursor-pointer ml-0.5 text-xs"
                                    title="Remove worker"
                                >
                                    ×
                                </button>
                            )}
                        </span>
                    ))
                )}

                <div className="ml-auto text-xs text-[#4B5563]">
                    {isOpen ? '▲' : '▼'}
                </div>
            </div>

            {/* Dropdown panel */}
            {isOpen && !disabled && !isLoading && (
                <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-[#FEF3C7] rounded-xl shadow-xl max-h-60 overflow-y-auto p-2 space-y-1">
                    <input
                        type="text"
                        placeholder="Search worker by name or phone..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full px-3 py-1.5 text-xs border border-[#FEF3C7] rounded-lg focus:outline-none focus:border-[#F97316]"
                    />

                    {filteredWorkers.length === 0 ? (
                        <p className="text-xs text-[#9CA3AF] italic p-2 text-center">
                            No eligible workers found.
                        </p>
                    ) : (
                        filteredWorkers.map(w => {
                            const isSelected = selectedWorkerIds.includes(w._id?.toString() || w._id);
                            return (
                                <div
                                    key={w._id}
                                    onClick={() => toggleWorker(w._id)}
                                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs cursor-pointer transition-colors ${
                                        isSelected ? 'bg-[#FEF3C7] text-[#9A3412] font-bold' : 'hover:bg-orange-50 text-[#111827]'
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => {}}
                                            className="rounded accent-[#F97316]"
                                        />
                                        <div>
                                            <div className="font-semibold">{w.name}</div>
                                            {w.phone && <div className="text-[10px] text-[#6B7280]">{w.phone}</div>}
                                        </div>
                                    </div>
                                    {isSelected && <span className="text-[#F97316] font-bold">✓</span>}
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
}

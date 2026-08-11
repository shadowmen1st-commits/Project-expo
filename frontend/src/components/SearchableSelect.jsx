import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search, X, Check } from 'lucide-react';

export default function SearchableSelect({
    options = [],
    value = '',
    onChange,
    placeholder = 'Select option...',
    disabledPlaceholder = 'Select category first',
    disabled = false,
    label,
    required = false,
    error = '',
    id,
    className = ''
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const containerRef = useRef(null);
    const searchInputRef = useRef(null);
    const optionsListRef = useRef(null);

    // Filter options based on search term
    const filteredOptions = options.filter(opt =>
        opt.toLowerCase().includes(searchTerm.trim().toLowerCase())
    );

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

    // Focus search input when dropdown opens
    useEffect(() => {
        if (isOpen) {
            setSearchTerm('');
            setFocusedIndex(-1);
            setTimeout(() => {
                if (searchInputRef.current) {
                    searchInputRef.current.focus();
                }
            }, 50);
        }
    }, [isOpen]);

    // Handle Keyboard Navigation
    const handleKeyDown = (e) => {
        if (disabled) return;

        if (!isOpen) {
            if (['Enter', 'ArrowDown', 'ArrowUp', ' '].includes(e.key)) {
                e.preventDefault();
                setIsOpen(true);
            }
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setFocusedIndex(prev => (prev < filteredOptions.length - 1 ? prev + 1 : 0));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setFocusedIndex(prev => (prev > 0 ? prev - 1 : filteredOptions.length - 1));
                break;
            case 'Enter':
                e.preventDefault();
                if (focusedIndex >= 0 && focusedIndex < filteredOptions.length) {
                    handleSelect(filteredOptions[focusedIndex]);
                }
                break;
            case 'Escape':
                e.preventDefault();
                setIsOpen(false);
                break;
            default:
                break;
        }
    };

    // Scroll focused option into view
    useEffect(() => {
        if (focusedIndex >= 0 && optionsListRef.current) {
            const item = optionsListRef.current.children[focusedIndex];
            if (item) {
                item.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [focusedIndex]);

    const handleSelect = (option) => {
        if (onChange) {
            onChange(option);
        }
        setIsOpen(false);
        setSearchTerm('');
    };

    const handleClear = (e) => {
        e.stopPropagation();
        if (onChange) {
            onChange('');
        }
    };

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            {label && (
                <label 
                    htmlFor={id} 
                    className="block text-xs font-bold uppercase tracking-wider mb-1 text-[#111827]"
                >
                    {label} {required && <span className="text-red-500">*</span>}
                </label>
            )}

            <div
                id={id}
                tabIndex={disabled ? -1 : 0}
                onKeyDown={handleKeyDown}
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={`w-full rounded-xl px-4 py-2.5 text-sm border flex items-center justify-between transition-all duration-200 select-none shadow-xs ${
                    disabled
                        ? 'bg-gray-100/70 border-gray-200 text-gray-400 cursor-not-allowed'
                        : isOpen
                        ? 'bg-white border-[#F97316] ring-2 ring-[#F97316]/20 cursor-pointer'
                        : value
                        ? 'bg-white border-[#FDE68A] text-[#111827] cursor-pointer hover:border-[#FCD34D]'
                        : 'bg-white border-[#FEF3C7] text-[#9CA3AF] cursor-pointer hover:border-[#FCD34D]'
                }`}
            >
                <span className="truncate font-medium">
                    {value || (disabled ? disabledPlaceholder : placeholder)}
                </span>

                <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                    {value && !disabled && (
                        <button
                            type="button"
                            onClick={handleClear}
                            title="Clear selection"
                            className="p-1 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                    <ChevronDown className={`w-4 h-4 text-[#78716C] transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#F97316]' : ''}`} />
                </div>
            </div>

            {/* Dropdown Popover */}
            {isOpen && !disabled && (
                <div className="absolute z-50 w-full mt-1.5 bg-white border border-[#FDE68A] rounded-2xl shadow-xl p-2.5 max-h-72 flex flex-col animate-in fade-in zoom-in-95 duration-100">
                    {/* Search Input Header */}
                    <div className="relative mb-2">
                        <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#9CA3AF]" />
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Search by typing..."
                            className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#FAF6F0] border border-[#E7E0D8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent text-[#111827] placeholder:text-[#9CA3AF]"
                        />
                    </div>

                    {/* Options List */}
                    <div 
                        ref={optionsListRef}
                        className="overflow-y-auto max-h-52 divide-y divide-gray-50 space-y-0.5 custom-scrollbar pr-1"
                    >
                        {filteredOptions.length === 0 ? (
                            <div className="py-4 text-center text-xs text-[#9CA3AF] italic">
                                No matching options found
                            </div>
                        ) : (
                            filteredOptions.map((opt, idx) => {
                                const isSelected = opt === value;
                                const isFocused = idx === focusedIndex;

                                return (
                                    <div
                                        key={opt}
                                        onClick={() => handleSelect(opt)}
                                        onMouseEnter={() => setFocusedIndex(idx)}
                                        className={`px-3 py-2 text-xs rounded-xl cursor-pointer flex items-center justify-between font-medium transition-all ${
                                            isSelected
                                                ? 'bg-[#FEF3C7] text-[#9A3412] font-bold'
                                                : isFocused
                                                ? 'bg-[#FAF6F0] text-[#111827]'
                                                : 'text-[#374151] hover:bg-[#FAF6F0]'
                                        }`}
                                    >
                                        <span className="truncate">{opt}</span>
                                        {isSelected && (
                                            <Check className="w-4 h-4 text-[#F97316] flex-shrink-0 ml-2" />
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            {error && (
                <p className="text-xs text-red-500 font-semibold mt-1">{error}</p>
            )}
        </div>
    );
}

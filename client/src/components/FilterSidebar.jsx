import React, { useState } from 'react';
import { ChevronDown, Star, X, Filter, MapPin } from 'lucide-react';

const FilterSection = ({ title, children, isOpen, onToggle }) => (
    <div className="border-b border-gray-200 dark:border-slate-700 py-4">
        <div
            className="flex items-center justify-between cursor-pointer mb-2 group"
            onClick={onToggle}
        >
            <h3 className="font-bold text-gray-800 dark:text-white text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{title}</h3>
            <div className={`transform transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
                <ChevronDown className="w-4 h-4 text-gray-500 dark:text-slate-400 group-hover:text-blue-500 transition-colors" />
            </div>
        </div>
        <div className={`overflow-hidden p-1 transition-all duration-300 ease-out ${isOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`} >
            <div className="mt-2 space-y-2">
                {children}
            </div>
        </div>
    </div>
);

const CheckboxFilter = ({ label, checked, onChange, count }) => (
    <label className="flex items-center justify-between cursor-pointer group p-1 rounded-lg hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-colors">
        <div className="flex items-center">
            <div className="relative">
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={onChange}
                    className="w-5 h-5 border-2 border-gray-300 dark:border-slate-600 rounded checked:bg-blue-600 checked:border-blue-600 focus:ring-0 focus:ring-offset-0 transition-all duration-200 cursor-pointer appearance-none"
                />
                {checked && (
                    <svg className="absolute inset-0 w-5 h-5 text-white pointer-events-none animate-scale-in" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                )}
            </div>
            <span className="ml-3 text-gray-700 dark:text-slate-300 text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{label}</span>
        </div>
        {count !== undefined && <span className="text-xs text-gray-400 dark:text-slate-500 bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">{count}</span>}
    </label>
);

const FilterSidebar = ({
    filters,
    onFilterChange,
    filterOptions = {},
    priceBounds = { min: 0, max: 100000 }
}) => {
    const [openSections, setOpenSections] = useState({
        hotelName: true,
        price: true,
        starRating: true,
        guestRating: true,
        amenities: false,
        mealPlans: false,
        cancellation: false,
    });

    const [isMobileOpen, setIsMobileOpen] = useState(false);

    // Lock page scroll when mobile filter drawer is open
    React.useEffect(() => {
        if (isMobileOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isMobileOpen]);

    const toggleSection = (section) => {
        setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const handleCheckboxChange = (category, value) => {
        const currentValues = filters[category] || [];
        const newValues = currentValues.includes(value)
            ? currentValues.filter(v => v !== value)
            : [...currentValues, value];
        onFilterChange({ ...filters, [category]: newValues });
    };

    const handlePriceChange = (type, value) => {
        const numValue = parseInt(value) || 0;
        if (type === 'min') {
            onFilterChange({
                ...filters,
                priceRange: {
                    ...filters.priceRange,
                    min: Math.min(numValue, filters.priceRange?.max || priceBounds.max)
                }
            });
        } else {
            onFilterChange({
                ...filters,
                priceRange: {
                    ...filters.priceRange,
                    max: Math.max(numValue, filters.priceRange?.min || 0)
                }
            });
        }
    };

    const clearAll = () => {
        onFilterChange({
            priceRange: { min: priceBounds.min, max: priceBounds.max },
            hotelName: '',
            starRating: [],
            guestRating: [],
            amenities: [],
            mealPlans: [],
            cancellation: [],
        });
    };

    const activeFilterCount = Object.entries(filters).reduce((acc, [key, value]) => {
        if (key === 'priceRange') return acc;
        if (key === 'hotelName') return acc + (value?.trim() ? 1 : 0);
        return acc + (Array.isArray(value) ? value.length : 0);
    }, 0);

    // Get dynamic options from props or use defaults
    const hotelNameOptions = filterOptions.hotelNames || [];
    const starRatingOptions = filterOptions.starRatings || {};
    const guestRatingOptions = filterOptions.guestRatings || {};
    const amenityOptions = filterOptions.amenities || {};
    const mealPlanOptions = filterOptions.mealPlans || {};
    const cancellationOptions = filterOptions.cancellation || {};

    // Format price for display
    const formatPrice = (price) => {
        return new Intl.NumberFormat('en-IN').format(price);
    };

    return (
        <>
            {/* Mobile Toggle */}
            <div className="lg:hidden mb-4">
                <button
                    onClick={() => setIsMobileOpen(true)}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 text-blue-600 dark:text-blue-400 font-bold rounded-lg border border-blue-200 dark:border-blue-800 hover:from-blue-100 hover:to-blue-200 dark:hover:from-blue-900/50 dark:hover:to-blue-800/50 transition-all duration-300 shadow-sm hover:shadow"
                >
                    <Filter className="w-4 h-4" />
                    Filter Results {activeFilterCount > 0 && <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">{activeFilterCount}</span>}
                </button>
            </div>

            {/* Sidebar Container with smooth slide animation */}
            <div className={`
        fixed inset-0 z-50 bg-white dark:bg-slate-900 transform transition-transform duration-300 ease-out lg:relative lg:inset-auto lg:transform-none lg:block lg:w-72 lg:bg-transparent lg:z-auto
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
                <div className="h-full overflow-y-auto p-4 lg:p-0 bg-white dark:bg-slate-900 lg:bg-transparent dark:lg:bg-transparent lg:sticky lg:top-4">

                    {/* Header */}
                    <div className="flex items-center justify-between mb-4 lg:hidden">
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white">Filters</h2>
                        <button onClick={() => setIsMobileOpen(false)} className="p-2">
                            <X className="w-6 h-6 text-gray-500 dark:text-slate-400" />
                        </button>
                    </div>

                    {/* Map Placeholder (Agoda style) - Enhanced */}
                    <div className="hidden lg:flex items-center justify-center h-24 bg-gradient-to-r from-blue-100 to-blue-200 dark:from-blue-900/30 dark:to-blue-800/30 rounded-lg mb-4 border border-blue-200 dark:border-blue-800 cursor-pointer hover:from-blue-200 hover:to-blue-300 dark:hover:from-blue-900/50 dark:hover:to-blue-800/50 transition-all duration-300 relative overflow-hidden group shadow-sm hover:shadow">
                        <div className="absolute inset-0 opacity-20 bg-[url('https://cdn6.agoda.net/images/MVC/default/background_image/illustrations/bg-agoda-homepage.png')] bg-cover bg-center"></div>
                        <span className="text-blue-700 dark:text-blue-400 font-bold relative z-10 flex items-center gap-2 group-hover:scale-105 transition-transform">
                            <MapPin className="w-4 h-4" />
                            Show on map
                        </span>
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden animate-fade-in theme-transition">
                        {/* Filter Header */}
                        <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between bg-gradient-to-r from-gray-50 to-gray-100 dark:from-slate-800 dark:to-slate-700">
                            <span className="font-bold text-gray-700 dark:text-white">Filter by</span>
                            <button
                                onClick={clearAll}
                                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium hover:underline transition-colors"
                            >
                                Clear all
                            </button>
                        </div>

                        <div className="p-4">
                            <FilterSection
                                title="Hotel name"
                                isOpen={openSections.hotelName}
                                onToggle={() => toggleSection('hotelName')}
                            >
                                <div className="space-y-3">
                                    <input
                                        type="text"
                                        value={filters.hotelName || ''}
                                        onChange={(e) => onFilterChange({ ...filters, hotelName: e.target.value })}
                                        placeholder="Search by hotel name"
                                        className="w-full rounded-lg border border-gray-300 dark:border-slate-600 px-3 py-2 text-sm text-gray-700 dark:text-slate-200 bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />

                                    {filters.hotelName?.trim() && hotelNameOptions.length > 0 && (
                                        <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/60">
                                            {hotelNameOptions
                                                .filter(name => name.toLowerCase().includes(filters.hotelName.toLowerCase()))
                                                .slice(0, 8)
                                                .map(name => (
                                                    <button
                                                        key={name}
                                                        type="button"
                                                        onClick={() => onFilterChange({ ...filters, hotelName: name })}
                                                        className="block w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                                                    >
                                                        {name}
                                                    </button>
                                                ))}
                                        </div>
                                    )}
                                </div>
                            </FilterSection>

                            {/* Price Range */}
                            <FilterSection
                                title="Price per night (₹)"
                                isOpen={openSections.price}
                                onToggle={() => toggleSection('price')}
                            >
                                <div className="px-2">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="border border-gray-300 rounded p-2 w-28 text-center">
                                            <span className="text-xs text-gray-500 block">Min</span>
                                            <span className="font-bold text-gray-800">₹{formatPrice(filters.priceRange?.min || 0)}</span>
                                        </div>
                                        <div className="h-[1px] w-4 bg-gray-300"></div>
                                        <div className="border border-gray-300 rounded p-2 w-28 text-center">
                                            <span className="text-xs text-gray-500 block">Max</span>
                                            <span className="font-bold text-gray-800">₹{formatPrice(filters.priceRange?.max || priceBounds.max)}+</span>
                                        </div>
                                    </div>
                                    {/* Dual range slider simulation with two sliders */}
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-xs text-gray-500">Min Price</label>
                                            <input
                                                type="range"
                                                min={priceBounds.min}
                                                max={priceBounds.max}
                                                step={500}
                                                value={filters.priceRange?.min || 0}
                                                onChange={(e) => handlePriceChange('min', e.target.value)}
                                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500">Max Price</label>
                                            <input
                                                type="range"
                                                min={priceBounds.min}
                                                max={priceBounds.max}
                                                step={500}
                                                value={filters.priceRange?.max || priceBounds.max}
                                                onChange={(e) => handlePriceChange('max', e.target.value)}
                                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </FilterSection>

                            {/* Star Rating - Dynamic */}
                            <FilterSection
                                title="Star rating"
                                isOpen={openSections.starRating}
                                onToggle={() => toggleSection('starRating')}
                            >
                                {Object.keys(starRatingOptions).length > 0 ? (
                                    [5, 4, 3, 2, 1].filter(star => starRatingOptions[star] !== undefined).map(star => (
                                        <CheckboxFilter
                                            key={star}
                                            label={
                                                <div className="flex items-center">
                                                    <div className="flex text-yellow-400">
                                                        {[...Array(star)].map((_, i) => <Star key={i} className="w-3 h-3 fill-current" />)}
                                                    </div>
                                                    <span className="ml-2 text-sm text-gray-600">{star} Star</span>
                                                </div>
                                            }
                                            checked={filters.starRating?.includes(star)}
                                            onChange={() => handleCheckboxChange('starRating', star)}
                                            count={starRatingOptions[star] || 0}
                                        />
                                    ))
                                ) : (
                                    [5, 4, 3, 2, 1].map(star => (
                                        <CheckboxFilter
                                            key={star}
                                            label={
                                                <div className="flex items-center">
                                                    <div className="flex text-yellow-400">
                                                        {[...Array(star)].map((_, i) => <Star key={i} className="w-3 h-3 fill-current" />)}
                                                    </div>
                                                    <span className="ml-2 text-sm text-gray-600">{star} Star</span>
                                                </div>
                                            }
                                            checked={filters.starRating?.includes(star)}
                                            onChange={() => handleCheckboxChange('starRating', star)}
                                        />
                                    ))
                                )}
                            </FilterSection>

                            {/* Guest Rating - Dynamic */}
                            <FilterSection
                                title="Guest rating"
                                isOpen={openSections.guestRating}
                                onToggle={() => toggleSection('guestRating')}
                            >
                                {Object.keys(guestRatingOptions).length > 0 ? (
                                    Object.entries(guestRatingOptions)
                                        .sort((a, b) => parseInt(b[0]) - parseInt(a[0]))
                                        .map(([rating, count]) => (
                                            <CheckboxFilter
                                                key={rating}
                                                label={`${rating}+ Rating`}
                                                checked={filters.guestRating?.includes(rating)}
                                                onChange={() => handleCheckboxChange('guestRating', rating)}
                                                count={count}
                                            />
                                        ))
                                ) : (
                                    ['9', '8', '7', '6'].map(rating => (
                                        <CheckboxFilter
                                            key={rating}
                                            label={`${rating}+ Rating`}
                                            checked={filters.guestRating?.includes(rating)}
                                            onChange={() => handleCheckboxChange('guestRating', rating)}
                                        />
                                    ))
                                )}
                            </FilterSection>

                            {/* Amenities - Dynamic */}
                            <FilterSection
                                title="Amenities"
                                isOpen={openSections.amenities}
                                onToggle={() => toggleSection('amenities')}
                            >
                                {Object.keys(amenityOptions).length > 0 ? (
                                    Object.entries(amenityOptions)
                                        .sort((a, b) => b[1] - a[1])
                                        .slice(0, 10)
                                        .map(([amenity, count]) => (
                                            <CheckboxFilter
                                                key={amenity}
                                                label={amenity}
                                                checked={filters.amenities?.includes(amenity)}
                                                onChange={() => handleCheckboxChange('amenities', amenity)}
                                                count={count}
                                            />
                                        ))
                                ) : (
                                    <p className="text-sm text-gray-500">No amenities data available</p>
                                )}
                            </FilterSection>

                            {/* Meal Plans - Dynamic */}
                            <FilterSection
                                title="Meal plans"
                                isOpen={openSections.mealPlans}
                                onToggle={() => toggleSection('mealPlans')}
                            >
                                {Object.keys(mealPlanOptions).length > 0 ? (
                                    Object.entries(mealPlanOptions)
                                        .sort((a, b) => b[1] - a[1])
                                        .map(([plan, count]) => (
                                            <CheckboxFilter
                                                key={plan}
                                                label={plan}
                                                checked={filters.mealPlans?.includes(plan)}
                                                onChange={() => handleCheckboxChange('mealPlans', plan)}
                                                count={count}
                                            />
                                        ))
                                ) : (
                                    <p className="text-sm text-gray-500">No meal plan data available</p>
                                )}
                            </FilterSection>

                            {/* Cancellation Policy - Dynamic */}
                            <FilterSection
                                title="Cancellation policy"
                                isOpen={openSections.cancellation}
                                onToggle={() => toggleSection('cancellation')}
                            >
                                {Object.keys(cancellationOptions).length > 0 ? (
                                    Object.entries(cancellationOptions).map(([policy, count]) => (
                                        <CheckboxFilter
                                            key={policy}
                                            label={policy}
                                            checked={filters.cancellation?.includes(policy)}
                                            onChange={() => handleCheckboxChange('cancellation', policy)}
                                            count={count}
                                        />
                                    ))
                                ) : (
                                    <p className="text-sm text-gray-500">No cancellation data available</p>
                                )}
                            </FilterSection>
                        </div>

                        {/* Mobile Apply Button */}
                        <div className="lg:hidden p-4 border-t border-gray-200 sticky bottom-0 bg-white">
                            <button
                                onClick={() => setIsMobileOpen(false)}
                                className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold rounded-lg shadow-lg transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0"
                            >
                                Show Results
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile Overlay with fade — sits behind the drawer (z-40 < z-50) */}
            {isMobileOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden animate-fade-in"
                    onClick={() => setIsMobileOpen(false)}
                ></div>
            )}
        </>
    );
};


export default FilterSidebar;

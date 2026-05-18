import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import FilterSidebar from './FilterSidebar';

describe('FilterSidebar', () => {
    const mockFilters = {
        priceRange: { min: 0, max: 1000 },
        hotelName: '',
        starRating: [],
        guestRating: [],
        amenities: [],
        mealPlans: [],
        cancellation: [],
    };

    const mockOnFilterChange = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('renders current filter sections', () => {
        render(<FilterSidebar filters={mockFilters} onFilterChange={mockOnFilterChange} />);

        expect(screen.getByText('Hotel name')).toBeInTheDocument();
        expect(screen.getByText('Price per night (₹)')).toBeInTheDocument();
        expect(screen.getByText('Star rating')).toBeInTheDocument();
        expect(screen.getByText('Guest rating')).toBeInTheDocument();
    });

    test('updates hotel name filter', () => {
        render(
            <FilterSidebar
                filters={mockFilters}
                onFilterChange={mockOnFilterChange}
                filterOptions={{ hotelNames: ['The Oberoi Mumbai', 'Taj Palace Delhi'] }}
            />
        );

        fireEvent.change(screen.getByPlaceholderText('Search by hotel name'), {
            target: { value: 'oberoi' }
        });

        expect(mockOnFilterChange).toHaveBeenCalledWith({
            ...mockFilters,
            hotelName: 'oberoi'
        });
    });

    test('updates price range', () => {
        render(<FilterSidebar filters={mockFilters} onFilterChange={mockOnFilterChange} />);

        const sliders = screen.getAllByRole('slider');
        fireEvent.change(sliders[1], { target: { value: '500' } });

        expect(mockOnFilterChange).toHaveBeenCalled();
        const newFilters = mockOnFilterChange.mock.calls[0][0];
        expect(newFilters.priceRange.max).toBe(500);
    });

    test('clears all filters', () => {
        render(
            <FilterSidebar
                filters={{ ...mockFilters, hotelName: 'Taj', starRating: [5] }}
                onFilterChange={mockOnFilterChange}
            />
        );

        fireEvent.click(screen.getByText('Clear all'));

        expect(mockOnFilterChange).toHaveBeenCalledWith(expect.objectContaining({
            hotelName: '',
            starRating: [],
        }));
    });

    test('shows matching hotel name suggestions', () => {
        render(
            <FilterSidebar
                filters={{ ...mockFilters, hotelName: 'taj' }}
                onFilterChange={mockOnFilterChange}
                filterOptions={{ hotelNames: ['The Oberoi Mumbai', 'Taj Palace Delhi'] }}
            />
        );

        expect(screen.getByText('Taj Palace Delhi')).toBeInTheDocument();
    });
});

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
            priceRange: { min: 0, max: 100000 }
        }));
    });

    test('clears all filters and resets price range to 0 and max bounds', () => {
        render(
            <FilterSidebar
                filters={{ ...mockFilters, priceRange: { min: 500, max: 800 } }}
                priceBounds={{ min: 0, max: 5000 }}
                onFilterChange={mockOnFilterChange}
            />
        );

        fireEvent.click(screen.getByText('Clear all'));

        expect(mockOnFilterChange).toHaveBeenCalledWith(expect.objectContaining({
            priceRange: { min: 0, max: 5000 }
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

    test('selects a suggestion and calls onSearchHotel and onFilterChange', () => {
        const mockOnSearchHotel = jest.fn();
        render(
            <FilterSidebar
                filters={{ ...mockFilters, hotelName: 'taj' }}
                onFilterChange={mockOnFilterChange}
                onSearchHotel={mockOnSearchHotel}
                filterOptions={{ hotelNames: ['The Oberoi Mumbai', 'Taj Palace Delhi'] }}
            />
        );

        fireEvent.click(screen.getByText('Taj Palace Delhi'));

        expect(mockOnFilterChange).toHaveBeenCalledWith(expect.objectContaining({
            hotelName: 'Taj Palace Delhi'
        }));
        expect(mockOnSearchHotel).toHaveBeenCalledWith('Taj Palace Delhi');
    });

    test('executes search when Search Hotels button is clicked', () => {
        const mockOnSearchHotel = jest.fn();
        render(
            <FilterSidebar
                filters={{ ...mockFilters, hotelName: 'Oberoi' }}
                onFilterChange={mockOnFilterChange}
                onSearchHotel={mockOnSearchHotel}
                filterOptions={{ hotelNames: ['The Oberoi Mumbai'] }}
            />
        );

        fireEvent.click(screen.getByText('Search Hotels'));

        expect(mockOnSearchHotel).toHaveBeenCalledWith('Oberoi');
    });

    test('clears hotel name when clear button is clicked', () => {
        render(
            <FilterSidebar
                filters={{ ...mockFilters, hotelName: 'Taj' }}
                onFilterChange={mockOnFilterChange}
                filterOptions={{ hotelNames: ['Taj Palace Delhi'] }}
            />
        );

        const clearBtn = screen.getByTitle('Clear hotel name');
        fireEvent.click(clearBtn);

        expect(mockOnFilterChange).toHaveBeenCalledWith(expect.objectContaining({
            hotelName: ''
        }));
    });
});


import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HotelCard from './HotelCard';

jest.mock('../context/AuthContext', () => ({
    useAuth: () => ({
        currentUser: null,
        isHotelLiked: () => false,
        likeHotel: jest.fn(),
        unlikeHotel: jest.fn()
    })
}));

// Shape of a merged search result as HomePage builds it
const hotel = {
    HotelCode: '1001',
    HotelName: 'Test Hotel',
    HotelAddress: 'Test Location',
    HotelPicture: 'test-image.jpg',
    StarRating: 'FourStar',
    Rating: 4.5,
    ratingText: 'Excellent',
    reviews: 100,
    Facilities: ['Free WiFi', 'Pool'],
    Rooms: [{ Name: ['Deluxe Room'], TotalFare: 12345.6, IsRefundable: true, MealType: 'BreakFast' }]
};

const renderCard = (props = {}) =>
    render(<MemoryRouter><HotelCard hotel={hotel} {...props} /></MemoryRouter>);

describe('HotelCard', () => {
    test('renders hotel information', () => {
        renderCard();
        expect(screen.getByText('Test Hotel')).toBeInTheDocument();
        expect(screen.getByText('Test Location')).toBeInTheDocument();
        expect(screen.getByText('Excellent')).toBeInTheDocument();
        expect(screen.getByText('100 reviews')).toBeInTheDocument();
        expect(screen.getByText('Free WiFi')).toBeInTheDocument();
        expect(screen.getByText('4-Star')).toBeInTheDocument();
        expect(screen.getByText('Breakfast Included')).toBeInTheDocument();
    });

    test('shows the rounded total fare in INR', () => {
        renderCard();
        expect(screen.getByText('₹ 12,346')).toBeInTheDocument();
    });

    test('lazy-loads the hotel image', () => {
        renderCard();
        expect(screen.getByAltText('Test Hotel')).toHaveAttribute('loading', 'lazy');
    });

    test('free cancellation badge follows IsRefundable', () => {
        renderCard();
        expect(screen.getByText('Free cancellation')).toBeInTheDocument();
    });

    test('no free cancellation badge for non-refundable rooms', () => {
        render(
            <MemoryRouter>
                <HotelCard hotel={{ ...hotel, Rooms: [{ ...hotel.Rooms[0], IsRefundable: false }] }} />
            </MemoryRouter>
        );
        expect(screen.queryByText('Free cancellation')).not.toBeInTheDocument();
    });

    test('calls onSelect with the hotel when clicked', () => {
        const onSelect = jest.fn();
        renderCard({ onSelect });
        fireEvent.click(screen.getByText('Test Hotel'));
        expect(onSelect).toHaveBeenCalledWith(hotel);
    });
});

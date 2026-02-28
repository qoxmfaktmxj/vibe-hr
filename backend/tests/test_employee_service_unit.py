from app.services.employee_service import _chunked


def test_chunked_splits_values_by_size() -> None:
    assert _chunked([1, 2, 3, 4, 5], 2) == [[1, 2], [3, 4], [5]]


def test_chunked_empty_values_returns_empty_list() -> None:
    assert _chunked([], 3) == []


def test_chunked_size_larger_than_values_returns_single_chunk() -> None:
    assert _chunked([10, 20], 10) == [[10, 20]]

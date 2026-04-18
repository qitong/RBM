from src.edc.correlation import compute_correlation


def test_compute_correlation_returns_pearson_and_spearman():
    x = [1, 2, 3, 4, 5]
    y = [2, 4, 6, 8, 10]
    result = compute_correlation(x, y)
    assert "pearson" in result
    assert "spearman" in result
    assert isinstance(result["pearson"], float)
    assert isinstance(result["spearman"], float)


def test_perfect_positive_linear():
    x = [1, 2, 3, 4, 5]
    y = [2, 4, 6, 8, 10]
    result = compute_correlation(x, y)
    assert abs(result["pearson"] - 1.0) < 1e-6
    assert abs(result["spearman"] - 1.0) < 1e-6


def test_no_correlation_returns_near_zero():
    x = [1, 2, 3, 4, 5]
    y = [5, 1, 4, 2, 3]
    result = compute_correlation(x, y)
    assert -0.5 < result["pearson"] < 0.5


def test_regression_line_coefficients():
    x = [1, 2, 3, 4, 5]
    y = [2, 4, 6, 8, 10]
    result = compute_correlation(x, y)
    assert "slope" in result
    assert "intercept" in result
    assert abs(result["slope"] - 2.0) < 1e-6
    assert abs(result["intercept"] - 0.0) < 1e-6

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


def test_compute_correlation_single_point():
    result = compute_correlation([1.0], [2.0])
    assert result["pearson"] == 0.0
    assert result["spearman"] == 0.0
    assert result["slope"] == 0.0
    assert result["intercept"] == 0.0


def test_compute_trend_with_confidence_basic():
    from src.edc.correlation import compute_trend_with_confidence
    x = [1.0, 2.0, 3.0, 4.0]
    y = [2.0, 4.0, 6.0, 8.0]  # Perfect linear relationship
    result = compute_trend_with_confidence(x, y)
    assert result["slope"] == 2.0
    assert result["intercept"] == 0.0
    assert result["r_squared"] == 1.0
    assert len(result["trendLine"]) == 50
    assert len(result["upperBand"]) == 50
    assert len(result["lowerBand"]) == 50


def test_compute_trend_with_confidence_single_point():
    from src.edc.correlation import compute_trend_with_confidence
    result = compute_trend_with_confidence([1.0], [2.0])
    assert result["slope"] == 0.0
    assert result["intercept"] == 0.0
    assert result["r_squared"] == 0.0
    assert len(result["trendLine"]) == 0


def test_compute_trend_with_confidence_empty():
    from src.edc.correlation import compute_trend_with_confidence
    result = compute_trend_with_confidence([], [])
    assert result["slope"] == 0.0
    assert result["intercept"] == 0.0
    assert result["r_squared"] == 0.0
    assert len(result["trendLine"]) == 0


def test_compute_trend_with_confidence_bands():
    from src.edc.correlation import compute_trend_with_confidence
    x = [1.0, 2.0, 3.0, 4.0, 5.0]
    y = [2.1, 3.9, 6.1, 7.9, 10.1]  # Noisy linear relationship
    result = compute_trend_with_confidence(x, y, confidence=1.96)
    # Check that upper band is consistently above trend line
    # and lower band is consistently below trend line
    for i in range(len(result["trendLine"])):
        trend_y = result["trendLine"][i]["y"]
        upper_y = result["upperBand"][i]["y"]
        lower_y = result["lowerBand"][i]["y"]
        assert upper_y > trend_y
        assert lower_y < trend_y

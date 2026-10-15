package com.vibehr.time;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

/** Keeps KST business times in Java and UTC-naive values in the existing timestamp columns. */
@Converter
public class KstScheduleTimeConverter implements AttributeConverter<LocalDateTime, LocalDateTime> {
    @Override
    public LocalDateTime convertToDatabaseColumn(LocalDateTime value) {
        return value == null ? null : value.atZone(TimeFormula.KST).withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime();
    }

    @Override
    public LocalDateTime convertToEntityAttribute(LocalDateTime value) {
        return value == null ? null : value.atOffset(ZoneOffset.UTC).atZoneSameInstant(TimeFormula.KST).toLocalDateTime();
    }
}

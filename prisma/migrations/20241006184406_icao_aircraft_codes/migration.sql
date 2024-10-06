UPDATE flight
SET aircraft = CASE aircraft
                   WHEN 'A330' THEN 'A333'
                   WHEN 'EMB1' THEN 'E120'
                   WHEN 'EMB4' THEN 'E145'
                   WHEN 'EMB7' THEN 'E170'
                   WHEN 'A350' THEN 'A359'
                   WHEN 'A380' THEN 'A388'
                   WHEN 'B737' THEN 'B738'
                   WHEN 'B747' THEN 'B744'
                   WHEN 'B767' THEN 'B763'
                   WHEN 'B777' THEN 'B772'
                   WHEN 'B787' THEN 'B789'
                   WHEN 'AN124' THEN 'A124'
                   WHEN 'AN225' THEN 'A225'
                   ELSE aircraft
    END
WHERE aircraft IN
      ('A330', 'EMB1', 'EMB4', 'EMB7', 'A350', 'A380', 'B737', 'B747', 'B767', 'B777', 'B787', 'AN124', 'AN225');
